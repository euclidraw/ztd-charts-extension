import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_ASPECT_ID,
  EXTENSION_ID,
  planZtdChartChanges,
  registerZtdChartTools,
} from '../dist/plugin.js';

function createToolHarness() {
  const entities = new Map();
  const tools = new Map();
  const descriptors = [];
  const proposals = [];

  const world = {
    listEntityIds: () => [...entities.keys()],
    isAlive: id => entities.has(id),
    getCanonical: (id, aspect) => entities.get(id)?.[aspect],
    exportCanonicalSnapshot: () => Object.fromEntries(entities.entries()),
    applyCanonicalTransaction(_caller, ops) {
      for (const op of ops) {
        if (op.patch === null) {
          entities.delete(op.id);
        } else {
          const entry = entities.get(op.id) ?? {};
          entry[op.aspect] = { ...(entry[op.aspect] ?? {}), ...op.patch };
          entities.set(op.id, entry);
        }
      }
    },
  };

  const toolService = {
    register(spec) {
      tools.set(spec.id, spec);
      return () => tools.delete(spec.id);
    },
    registerDescriptor(desc) {
      descriptors.push(desc);
      return () => {};
    },
    prepareChange(ops) {
      const proposal = { changeProposalId: `proposal-${proposals.length + 1}`, operations: ops };
      proposals.push(proposal);
      return proposal;
    },
  };

  const dispose = registerZtdChartTools({
    world,
    services: {
      get(name) {
        return name === 'workspace.tools' ? toolService : undefined;
      },
    },
  });

  return { world, tools, descriptors, proposals, dispose };
}

test('workspace.tools registers catalog, suggest, search, descriptor, and plan-changes approval flow', async () => {
  const { world, tools, descriptors, dispose } = createToolHarness();
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].aspect, CHART_ASPECT_ID);

  // 1. Catalog tool
  const catalogTool = tools.get(`${EXTENSION_ID}:catalog`);
  const catalogRes = await catalogTool.execute({ family: 'flow', locale: 'ko' }, {});
  assert.ok(catalogRes.total >= 2);
  assert.ok(catalogRes.charts.some(c => c.type === 'sankey'));

  // 2. Suggest tool
  const suggestTool = tools.get(`${EXTENSION_ID}:suggest`);
  const suggestRes = await suggestTool.execute(
    { data: 'channel,revenue\n온라인,320\n오프라인,180\n파트너,95', locale: 'ko' },
    {},
  );
  assert.equal(suggestRes.rowCount, 3);
  assert.ok(suggestRes.suggestions.length > 0);

  // 3. Plan-changes tool prepares operations without mutating world
  const planTool = tools.get(`${EXTENSION_ID}:plan-changes`);
  const proposal = await planTool.execute(
    {
      actions: JSON.stringify([
        {
          action: 'create',
          id: 'sales-chart',
          x: 120,
          y: 160,
          width: 500,
          height: 360,
          patch: {
            chartType: 'bar',
            title: '채널별 매출 비교',
            data: 'channel,revenue\n온라인,320\n오프라인,180',
          },
        },
      ]),
    },
    {},
  );
  assert.equal(world.listEntityIds().length, 0, 'planning must not mutate world');
  assert.equal(proposal.operations.length, 3);

  // Apply planned operations
  world.applyCanonicalTransaction('test:approve', proposal.operations);
  assert.equal(world.listEntityIds().length, 1);
  const createdId = world.listEntityIds()[0];

  // 4. Search tool finds the created chart
  const searchTool = tools.get(`${EXTENSION_ID}:search`);
  const searchRes = await searchTool.execute({ query: '채널별' }, {});
  assert.equal(searchRes.total, 1);
  assert.equal(searchRes.entities[0].id, createdId);

  // 5. Update and delete via planZtdChartChanges
  const updateOps = planZtdChartChanges(world, [
    { action: 'update', id: createdId, patch: { chartType: 'pie', theme: 'dark' } },
    { action: 'move', id: createdId, x: 240, y: 300, width: 520, height: 380 },
  ]);
  assert.equal(updateOps.length, 3);
  world.applyCanonicalTransaction('test:update', updateOps);
  assert.equal(world.getCanonical(createdId, CHART_ASPECT_ID).chartType, 'pie');
  assert.equal(world.getCanonical(createdId, 'core.transform').x, 240);

  const deleteOps = planZtdChartChanges(world, [{ action: 'delete', id: createdId }]);
  world.applyCanonicalTransaction('test:delete', deleteOps);
  assert.equal(world.isAlive(createdId), false);

  dispose();
  assert.equal(tools.size, 0);
});
