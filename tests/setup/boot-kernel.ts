import '../../src/engine/boot';
import { afterEach } from 'vitest';
import { restoreKernelSpies } from '../helpers/kernel-spy';

afterEach(restoreKernelSpies);
