// Map boundaries are opt-in upstream. Register before either canvas or SVG rendering.
import { registerMap } from 'ztd-charts';
import { world } from 'ztd-charts/geo/world';
import { usStates } from 'ztd-charts/geo/us-states';
import { krSido } from 'ztd-charts/geo/kr-sido';

for (const map of [world, usStates, krSido]) registerMap(map);
