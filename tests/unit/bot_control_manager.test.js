import { jest } from '@jest/globals';
import { BotControlManager } from '../../src/services/bot_control_manager.js';

describe('BotControlManager', () => {
    let manager;

    beforeEach(() => {
        manager = new BotControlManager();
    });

    test('should set control state', () => {
        manager.setControl('bot1', 'forward', true);
        const state = manager.getState('bot1');
        expect(state.forward).toBe(true);
    });

    test('should toggle control state', () => {
        manager.setControl('bot1', 'jump', false);
        manager.toggleControl('bot1', 'jump');
        expect(manager.getState('bot1').jump).toBe(true);
        manager.toggleControl('bot1', 'jump');
        expect(manager.getState('bot1').jump).toBe(false);
    });

    test('should reset controls', () => {
        manager.setControl('bot1', 'forward', true);
        manager.setControl('bot1', 'jump', true);
        manager.resetControls('bot1');
        const state = manager.getState('bot1');
        expect(state.forward).toBe(false);
        expect(state.jump).toBe(false);
    });

    test('should manage sessions', (done) => {
        const emitFn = jest.fn();
        manager.startControlSession('bot1', emitFn);

        setTimeout(() => {
            manager.stopControlSession('bot1');
            expect(emitFn).toHaveBeenCalledWith('bot:state_update', expect.any(Object));
            done();
        }, 150);
    });
});
