/**
 * Copyright 2015 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as sinon from 'sinon';
import {AmpDocSingle} from '../../src/service/ampdoc-impl';
import {
  History,
  HistoryBindingNatural_,
  HistoryBindingVirtual_,
  installHistoryServiceForDoc,
} from '../../src/service/history-impl';
import {Services} from '../../src/services';
import {installTimerService} from '../../src/service/timer-impl';
import {listenOncePromise} from '../../src/event-helper';
import {parseUrl} from '../../src/url';


describes.fakeWin('History', {
  win: {
    location: '#first',
  },
}, env => {
  let sandbox;
  let clock;
  let bindingMock;
  let onStackIndexUpdated;
  let history;

  beforeEach(() => {
    installTimerService(env.win);
    sandbox = env.sandbox;
    clock = sandbox.useFakeTimers();

    const binding = {
      cleanup_: () => {},
      setOnStackIndexUpdated: callback => {
        onStackIndexUpdated = callback;
      },
      push: () => {},
      pop(unusedStackIndex) {},
      replace(opt_fragment, opt_state) {},
      get() {},
      replaceStateForTarget: () => {},
      getFragment: () => {},
      updateFragment: () => {},
    };
    bindingMock = sandbox.mock(binding);

    history = new History(new AmpDocSingle(env.win), binding);
  });

  afterEach(() => {
    bindingMock.verify();
  });

  it('should initialize correctly', () => {
    expect(history.stackIndex_).to.equal(0);
    expect(history.stackOnPop_.length).to.equal(0);
    expect(onStackIndexUpdated).to.not.equal(null);
  });

  it('should push new state', () => {
    const onPop = sandbox.spy();
    bindingMock.expects('push')
        .returns(Promise.resolve(11)).once();
    return history.push(onPop).then(unusedHistoryId => {
      expect(history.stackIndex_).to.equal(11);
      expect(history.stackOnPop_.length).to.equal(12);
      expect(history.stackOnPop_[11]).to.equal(onPop);
      expect(onPop).to.have.not.been.called;
    });
  });

  it('should pop previously pushed state', () => {
    const onPop = sandbox.spy();
    bindingMock.expects('push')
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('pop').withExactArgs(11)
        .returns(Promise.resolve({stackIndex: 10})).once();
    return history.push(onPop).then(historyId => {
      expect(historyId).to.equal(11);
      expect(history.stackOnPop_.length).to.equal(12);
      expect(history.stackOnPop_[11]).to.equal(onPop);
      expect(onPop).to.have.not.been.called;
      return history.pop(historyId).then(() => {
        expect(history.stackIndex_).to.equal(10);
        expect(history.stackOnPop_.length).to.equal(11);
        clock.tick(1);
        expect(onPop).to.be.calledOnce;
      });
    });
  });

  it('should return and call callback when history popped', () => {
    const onPop = sandbox.spy();
    bindingMock.expects('push').withExactArgs(undefined)
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('pop').withExactArgs(11)
        .returns(Promise.resolve({stackIndex: 10})).once();
    return history.push(onPop).then(stackIndex => {
      expect(onPop).to.have.not.been.called;
      return history.pop(stackIndex).then(() => {
        expect(history.stackIndex_).to.equal(10);
        expect(history.stackOnPop_.length).to.equal(11);
        clock.tick(1);
        expect(onPop).to.be.calledOnce;
        expect(onPop.getCall(0).args[0]).to.equal(undefined);
      });
    });
  });

  it('should return and call callback with state when history popped', () => {
    const onPop = sandbox.spy();
    const popState = {foo: 'bar'};
    bindingMock.expects('push').withExactArgs(undefined)
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('pop').withExactArgs(11)
        .returns(Promise.resolve({stackIndex: 10, state: popState})).once();
    return history.push(onPop).then(stackIndex => {
      expect(onPop).to.have.not.been.called;
      return history.pop(stackIndex).then(() => {
        expect(history.stackIndex_).to.equal(10);
        expect(history.stackOnPop_.length).to.equal(11);
        clock.tick(1);
        expect(onPop).to.be.calledOnce;
        expect(onPop.getCall(0).args[0]).to.deep.equal(popState);
      });
    });
  });

  it('should replace previously pushed state', () => {
    const onPop = sandbox.spy();
    const pushState = {foo: 'bar'};
    const replaceState = {foo: 'baz'};
    bindingMock.expects('push')
        .withExactArgs(pushState)
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('replace')
        .withExactArgs('', replaceState)
        .returns(Promise.resolve()).once();
    return history.push(onPop, pushState).then(historyId => {
      expect(historyId).to.equal(11);
      expect(history.stackOnPop_.length).to.equal(12);
      expect(history.stackOnPop_[11]).to.equal(onPop);
      expect(onPop).to.not.be.called;
      return history.replace('', replaceState).then(() => {
        // Replacing the state should not affect registered pop handlers
        expect(history.stackIndex_).to.equal(11);
        expect(history.stackOnPop_.length).to.equal(12);
        expect(history.stackOnPop_[11]).to.equal(onPop);
        expect(onPop).to.not.be.called;
      });
    });
  });

  it('should get previously pushed state', () => {
    const onPop = sandbox.spy();
    const state = {foo: 'bar'};
    bindingMock.expects('push')
        .withExactArgs(state)
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('get')
        .returns(Promise.resolve({stackIndex: 11, state})).once();
    return history.push(onPop, state).then(historyId => {
      expect(historyId).to.equal(11);
      expect(history.stackOnPop_.length).to.equal(12);
      expect(history.stackOnPop_[11]).to.equal(onPop);
      expect(onPop).to.not.be.called;
      return history.get().then(() => {
        // Reading the state should not affect registered pop handlers
        expect(history.stackIndex_).to.equal(11);
        expect(history.stackOnPop_.length).to.equal(12);
        expect(onPop).to.not.be.called;
      });
    });
  });

  it('should push a new state and replace it for target', () => {
    bindingMock.expects('push')
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('pop')
        .returns(Promise.resolve({stackIndex: 10})).once();
    bindingMock.expects('replaceStateForTarget').withExactArgs('#hello');
    return history.replaceStateForTarget('#hello').then(() => {
      return history.pop(history.stackIndex_).then(() => {
        clock.tick(1);
        expect(env.win.location.hash).to.equal('#first');
      });
    });
  });

  it('should pop previously pushed state via goBack', () => {
    const onPop = sandbox.spy();
    const popState = {foo: 'bar'};
    bindingMock.expects('push')
        .returns(Promise.resolve(11)).once();
    bindingMock.expects('pop')
        .withExactArgs(11)
        .returns(Promise.resolve({stackIndex: 10, state: popState})).once();
    return history.push(onPop).then(historyId => {
      expect(historyId).to.equal(11);
      expect(history.stackOnPop_.length).to.equal(12);
      expect(history.stackOnPop_[11]).to.equal(onPop);
      expect(onPop).to.not.be.called;
      return history.goBack().then(() => {
        expect(history.stackIndex_).to.equal(10);
        expect(history.stackOnPop_.length).to.equal(11);
        clock.tick(1);
        expect(onPop).to.be.calledOnce;
        expect(onPop).to.be.calledWith(popState);
      });
    });
  });

  it('should NOT pop first state via goBack', () => {
    bindingMock.expects('pop').never();
    return history.goBack().then(() => {
      expect(history.stackIndex_).to.equal(0);
    });
  });

  it('should get fragment', () => {
    bindingMock.expects('getFragment').withExactArgs()
        .returns(Promise.resolve('fragment')).once();
    return history.getFragment().then(fragment => {
      expect(fragment).to.be.equal('fragment');
    });
  });

  it('should update fragment', () => {
    bindingMock.expects('updateFragment').withExactArgs('fragment')
        .returns(Promise.resolve()).once();
    return history.updateFragment('fragment').then(() => {});
  });
});


describes.sandboxed('History install', {}, () => {
  let win;
  let ampdoc;
  let viewer;

  beforeEach(() => {
    viewer = {
      isOvertakeHistory: () => false,
      onMessage: () => function() {},
    };

    installTimerService(window);
    win = {
      services: {
        'viewer': {obj: viewer},
        'timer': {obj: Services.timerFor(window)},
      },
      history: {
        length: 0,
      },
      document: {
        body: {},
        querySelector: () => null,
      },
      location: parseUrl('https://cdn.ampproject.org/c/s/www.example.com/path'),
      addEventListener: () => null,
    };
    ampdoc = new AmpDocSingle(win);
    installHistoryServiceForDoc(ampdoc);
  });

  it('should create natural binding and make it singleton', () => {
    const history = Services.historyForDoc(ampdoc);
    expect(history.binding_).to.be.instanceOf(HistoryBindingNatural_);
    expect(win.services.history.obj).to.equal(history);
    // Ensure that binding is installed as a singleton.
    expect(win.services['global-history-binding'].obj)
        .to.equal(history.binding_);
  });

  it('should create virtual binding', () => {
    viewer.isOvertakeHistory = () => true;
    const history = Services.historyForDoc(ampdoc);
    expect(history.binding_).to.be.instanceOf(HistoryBindingVirtual_);
    expect(win.services.history.obj).to.equal(history);
    // Ensure that the global singleton has not been created.
    expect(win.services['global-history-binding']).to.not.exist;
  });
});


describes.sandboxed('HistoryBindingNatural', {}, () => {
  let clock;
  let onStackIndexUpdated;
  let history;

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
    onStackIndexUpdated = sandbox.spy();
    history = new HistoryBindingNatural_(window);
    history.setOnStackIndexUpdated(onStackIndexUpdated);
  });

  afterEach(() => {
    history.cleanup_();
  });

  it('should initialize correctly', () => {
    expect(history.stackIndex_).to.equal(window.history.length - 1);
    expect(history.startIndex_).to.equal(window.history.length - 1);
    expect(history.unsupportedState_['AMP.History']).to.equal(
        window.history.length - 1);
    expect(onStackIndexUpdated).to.have.not.been.called;
  });

  it('should initialize correctly with preexisting state', () => {
    history.origPushState_({'AMP.History': window.history.length}, undefined);
    history.origReplaceState_({'AMP.History': window.history.length - 2},
        undefined);
    const history2 = new HistoryBindingNatural_(window);
    expect(history2.stackIndex_).to.equal(window.history.length - 2);
    expect(history2.startIndex_).to.equal(window.history.length - 2);
    expect(history.unsupportedState_['AMP.History']).to.equal(
        window.history.length - 2);
    history2.cleanup_();
    history.origReplaceState_({'AMP.History': window.history.length - 1},
        undefined);
    expect(onStackIndexUpdated).to.have.not.been.called;
  });

  it('should preserve the initial state if possible', () => {
    history.origReplaceState_({'a': 11}, undefined);
    const history2 = new HistoryBindingNatural_(window);
    expect(history.getState_()['a']).to.equal(11);
    history2.cleanup_();
    expect(onStackIndexUpdated).to.have.not.been.called;
  });

  it('should override history.pushState and set its properties', () => {
    window.history.pushState({a: 111});
    expect(history.unsupportedState_.a).to.equal(111);
    expect(history.unsupportedState_['AMP.History']).to.equal(
        window.history.length - 1);
    expect(onStackIndexUpdated).to.be.calledOnce;
    expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(
        window.history.length - 1);
  });

  it('should override history.replaceState and set its properties', () => {
    window.history.replaceState({a: 112});
    expect(history.unsupportedState_.a).to.equal(112);
    expect(history.unsupportedState_['AMP.History']).to.equal(
        window.history.length - 1);
    expect(onStackIndexUpdated).to.have.not.been.called;
  });

  // This prevents IE11/Edge from coercing undefined to become the new url
  it('should not pass in `url` argument to original replace state if ' +
    'parameter is undefined', () => {
    const replaceStateSpy = sandbox.spy();
    const windowStub = {
      history: {
        replaceState: replaceStateSpy,
        pushState: () => {},
        state: {},
        length: 11,
      },
      addEventListener: () => {},
      setTimeout: window.setTimeout,
      clearTimeout: window.clearTimeout,
    };
    installTimerService(windowStub);
    new HistoryBindingNatural_(windowStub);
    expect(replaceStateSpy.callCount).to.be.greaterThan(0);
    expect(replaceStateSpy.lastCall.args.length).to.equal(2);
  });

  it('should push new state in the window.history and notify', () => {
    const state = {foo: 'bar'};
    return history.push(state).then(stackIndex => {
      expect(history.stackIndex_).to.equal(stackIndex);
      expect(history.stackIndex_).to.equal(window.history.length - 1);
      expect(history.unsupportedState_['AMP.History']).to.equal(
          window.history.length - 1);
      expect(history.unsupportedState_).to.deep.equal(state);
      expect(onStackIndexUpdated).to.be.calledOnce;
      expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(
          window.history.length - 1);
      expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(
          state);
    });
  });

  it('should pop a state from the window.history and notify', () => {
    const state = {foo: 'bar'};
    return history.push(state).then(stackIndex => {
      expect(onStackIndexUpdated).to.be.calledOnce;
      expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(
          window.history.length - 1);
      expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(
          state);
      const histPromise = listenOncePromise(window, 'popstate').then(() => {
        clock.tick(100);
      });
      const popPromise = history.pop(stackIndex);
      return histPromise.then(unusedHist => {
        return popPromise.then(pop => {
          expect(pop.stackIndex).to.equal(window.history.length - 2);
          expect(history.stackIndex_).to.equal(window.history.length - 2);
          expect(history.unsupportedState_['AMP.History']).to.equal(
              window.history.length - 2);
          expect(onStackIndexUpdated).to.have.callCount(2);
          expect(onStackIndexUpdated.getCall(1).args[0].stackIndex).to.equal(
              window.history.length - 2);
        });
      });
    });
  });

  it('should restore previous state after pop and notify', () => {
    const firstState = {foo: 'bar'};
    const secondState = {foo: 'baz'};
    return history.push(firstState).then(firstStackIndex => {
      return history.push(secondState).then(secondStackIndex => {
        expect(onStackIndexUpdated).to.have.callCount(2);
        const histPromise = listenOncePromise(window, 'popstate').then(() => {
          clock.tick(100);
        });
        const popPromise = history.pop(secondStackIndex);
        return histPromise.then(unusedHist => {
          return popPromise.then(pop => {
            expect(pop.stackIndex).to.equal(firstStackIndex);
            expect(history.stackIndex_).to.equal(firstStackIndex);
            expect(history.unsupportedState_['AMP.History']).to.equal(
                firstStackIndex);
            expect(onStackIndexUpdated).to.have.callCount(3);
            expect(onStackIndexUpdated.getCall(2).args[0].stackIndex).to.equal(
                firstStackIndex);
            expect(onStackIndexUpdated.getCall(2).args[0].state).to.deep.equal(
                firstState);
          });
        });
      });
    });
  });

  it('should get current state', () => {
    const state = {foo: 'bar'};
    return history.push(state).then(stackIndex => {
      expect(history.unsupportedState_['AMP.History']).to.equal(stackIndex);
      expect(history.unsupportedState_).to.deep.equal(state);
      return history.get().then(current => {
        expect(current.state).to.deep.equal(state);
        expect(current.state['AMP.History']).to.equal(stackIndex);
      });
    });
  });

  it('should replace current state', () => {
    const pushState = {foo: 'bar'};
    const replaceState = {foo: 'baz'};
    return history.push(pushState).then(stackIndex => {
      expect(history.unsupportedState_['AMP.History']).to.equal(stackIndex);
      expect(history.unsupportedState_).to.deep.equal(pushState);
      return history.replace('', replaceState).then(() => {
        expect(history.unsupportedState_['AMP.History']).to.equal(stackIndex);
        expect(history.unsupportedState_).to.deep.equal(replaceState);
      });
    });
  });

  it('should update its state and notify on history.back', () => {
    // Push twice.
    return Promise.all([history.push(), history.push()]).then(() => {
      const h = window.history.length;

      expect(onStackIndexUpdated).to.be.calledTwice;
      expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(h - 2);
      expect(onStackIndexUpdated.getCall(1).args[0].stackIndex).to.equal(h - 1);

      // Pop once.
      const popstate = listenOncePromise(window, 'popstate').then(() => {
        clock.tick(100);
      });
      window.history.go(-1);
      return popstate;
    }).then(() => {
      const h = window.history.length - 2;

      clock.tick(100);
      expect(history.stackIndex_).to.equal(h);
      expect(history.unsupportedState_['AMP.History']).to.equal(h);
      expect(onStackIndexUpdated).to.be.calledThrice;
      expect(onStackIndexUpdated.getCall(2).args[0].stackIndex).to.equal(h);

      // Pop again.
      const popstate = listenOncePromise(window, 'popstate').then(() => {
        clock.tick(100);
      });
      window.history.go(-1);
      return popstate;
    }).then(() => {
      const h = window.history.length - 3;

      clock.tick(100);
      expect(history.stackIndex_).to.equal(h);
      expect(history.unsupportedState_['AMP.History']).to.equal(h);
      expect(onStackIndexUpdated).to.have.callCount(4);
      expect(onStackIndexUpdated.getCall(3).args[0].stackIndex).to.equal(h);
    });
  });
});


describe('HistoryBindingVirtual', () => {

  let sandbox;
  let clock;
  let onStackIndexUpdated;
  let history;
  let viewer;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    clock = sandbox.useFakeTimers();
    onStackIndexUpdated = sandbox.spy();
    viewer = {
      onMessage: sandbox.stub().returns(() => {}),
      sendMessageAwaitResponse: sandbox.stub().returns(Promise.resolve()),
    };
    history = new HistoryBindingVirtual_(window, viewer);
    history.setOnStackIndexUpdated(onStackIndexUpdated);
  });

  afterEach(() => {
    history.cleanup_();
    sandbox.restore();
  });

  it('should initialize correctly', () => {
    expect(history.stackIndex_).to.equal(0);
    expect(onStackIndexUpdated).to.have.not.been.called;
    expect(viewer.onMessage.firstCall.args[0]).to.not.equal(undefined);
  });

  it('should push new state to viewer and notify', () => {
    const state = {foo: 'bar'};
    return history.push(state).then(stackIndex => {
      expect(viewer.sendMessageAwaitResponse).to.be.calledOnce;
      expect(viewer.sendMessageAwaitResponse.lastCall.args[0])
          .to.equal('pushHistory');
      expect(viewer.sendMessageAwaitResponse.lastCall.args[1].stackIndex)
          .to.equal(1);
      expect(viewer.sendMessageAwaitResponse.lastCall.args[1].state)
          .to.deep.equal(state);
      expect(stackIndex).to.equal(1);
      expect(history.stackIndex_).to.equal(1);
      expect(onStackIndexUpdated).to.be.calledOnce;
      expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(1);
      expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(state);
    });
  });

  it('should pop a state from the window.history and notify', () => {
    const state = {foo: 'bar'};
    viewer.sendMessageAwaitResponse
        .withArgs('popHistory', {stackIndex: 1})
        .returns(Promise.resolve({stackIndex: 0, state}));
    return history.push(state).then(stackIndex => {
      expect(viewer.sendMessageAwaitResponse).to.be.calledOnce;
      expect(viewer.sendMessageAwaitResponse.lastCall.args[0])
          .to.equal('pushHistory');
      expect(viewer.sendMessageAwaitResponse.lastCall.args[1].stackIndex)
          .to.equal(1);
      expect(viewer.sendMessageAwaitResponse.lastCall.args[1].state)
          .to.deep.equal(state);
      expect(stackIndex).to.equal(1);
      expect(onStackIndexUpdated).to.be.calledOnce;
      expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(1);
      expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(state);
      return history.pop(stackIndex).then(historyState => {
        expect(historyState.stackIndex).to.equal(0);
        expect(historyState.state).to.equal(state);
        expect(history.stackIndex_).to.equal(0);
        expect(onStackIndexUpdated).to.have.callCount(2);
        expect(onStackIndexUpdated.getCall(1).args[0].stackIndex).to.equal(0);
        expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(
            state);
      });
    });
  });

  it('should send replace state to viewer', () => {
    const state = {foo: 'bar'};
    const replaceState = {foo: 'baz'};
    return history.push(state).then(stackIndex => {
      expect(stackIndex).to.equal(1);
      return history.replace('', replaceState).then(() => {
        expect(history.stackIndex_).to.equal(1);
      });
    });
  });

  it('should send get state to viewer', () => {
    const state = {foo: 'bar'};
    viewer.sendMessageAwaitResponse
        .withArgs('getHistory')
        .returns(Promise.resolve({stackIndex: 1, state}));
    return history.push(state).then(stackIndex => {
      expect(stackIndex).to.equal(1);
      expect(history.stackIndex_).to.equal(1);
      return history.get().then(historyState => {
        expect(historyState.stackIndex).to.equal(1);
        expect(historyState.state).to.deep.equal(state);
        expect(history.stackIndex_).to.equal(1);
      });
    });
  });

  it('should update its state and notify on history.back', () => {
    const state = {foo: 'bar'};
    return history.push(state).then(stackIndex => {
      expect(viewer.sendMessageAwaitResponse).to.be.calledOnce;
      expect(viewer.sendMessageAwaitResponse.lastCall.args[0])
          .to.equal('pushHistory');
      expect(viewer.sendMessageAwaitResponse.lastCall.args[1].stackIndex)
          .to.equal(1);
      expect(viewer.sendMessageAwaitResponse.lastCall.args[1].state)
          .to.deep.equal(state);
      expect(stackIndex).to.equal(1);
      expect(onStackIndexUpdated).to.be.calledOnce;
      expect(onStackIndexUpdated.getCall(0).args[0].stackIndex).to.equal(1);
      expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(state);
      viewer.onMessage.firstCall.args[1]({newStackIndex: 0, state});
      clock.tick(1);
      expect(history.stackIndex_).to.equal(0);
      expect(onStackIndexUpdated).to.have.callCount(2);
      expect(onStackIndexUpdated.getCall(1).args[0].stackIndex).to.equal(0);
      expect(onStackIndexUpdated.getCall(0).args[0].state).to.deep.equal(state);
    });
  });
});

describes.fakeWin('Local Hash Navigation', {
  win: {
    location: '#first',
  },
}, env => {

  let sandbox;
  let clock;
  let history;

  beforeEach(() => {
    installTimerService(env.win);
    sandbox = env.sandbox;
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    if (history) {
      history.cleanup_();
    }
  });

  it('should push a new state and replace it for target on Natural', () => {
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingNatural_(env.win));
    const startIndex = env.win.history.index;
    return history.replaceStateForTarget('#hello').then(() => {
      clock.tick(1);
      expect(env.win.location.hash).to.equal('#hello');
      expect(env.win.history.index).to.equal(startIndex + 1);
      const historyPopPromise = history.pop(history.stackIndex_);

      clock.tick(1);
      return historyPopPromise.then(() => {
        expect(env.win.location.hash).to.equal('#first');
        expect(env.win.history.index).to.equal(startIndex);
      });
    });
  });

  it('should push a new state and replace it for target on Virtual', () => {
    const viewer = {
      onMessage: () => {
        return () => {};
      },
      postPushHistory: unusedStackIndex => {},
      postPopHistory: unusedStackIndex => {},
      sendMessageAwaitResponse: () => Promise.resolve(),
    };
    const viewerMock = sandbox.mock(viewer);
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingVirtual_(env.win, viewer));
    const startIndex = history.stackIndex_;

    viewerMock.expects('postPushHistory').withExactArgs(1).once().returns(
        Promise.resolve());
    viewerMock.expects('postPopHistory').withExactArgs(1).once().returns(
        Promise.resolve());
    return history.replaceStateForTarget('#hello').then(() => {
      clock.tick(1);
      expect(env.win.location.hash).to.equal('#hello');
      expect(history.stackIndex_).to.equal(startIndex + 1);
      return history.pop(history.stackIndex_).then(() => {
        clock.tick(1);
        expect(env.win.location.hash).to.equal('#first');
        expect(history.stackIndex_).to.equal(startIndex);
      });
    });
  });
});

describes.fakeWin('Get and update fragment', {}, env => {

  let sandbox;
  let history;
  let viewer;
  let viewerMock;

  beforeEach(() => {
    installTimerService(env.win);
    sandbox = env.sandbox;
    viewer = {
      onMessage: () => {
        return () => {};
      },
      hasCapability: () => {},
      sendMessageAwaitResponse: () => {},
    };
    viewerMock = sandbox.mock(viewer);
  });

  afterEach(() => {
    viewerMock.verify();
    if (history) {
      history.cleanup_();
    }
  });

  it('should get fragment on Natural', () => {
    env.win.location.href = 'http://www.example.com#foo';
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingNatural_(env.win));
    return history.getFragment().then(fragment => {
      expect(fragment).to.be.equal('foo');
    });
  });

  it('should update fragment on Natural', () => {
    env.win.location.href = 'http://www.example.com#foo';
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingNatural_(env.win));
    const replaceStateSpy = sandbox.spy();
    env.win.history.replaceState = replaceStateSpy;
    return history.updateFragment('bar').then(() => {
      expect(replaceStateSpy).to.be.calledOnce;
      expect(replaceStateSpy.lastCall.args).to.jsonEqual([{}, '', '#bar']);
    });
  });

  it('should update fragment on Natural ' +
      'if the url does not contain fragment previously', () => {
    env.win.location.href = 'http://www.example.com';
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingNatural_(env.win));
    const replaceStateSpy = sandbox.spy();
    env.win.history.replaceState = replaceStateSpy;
    return history.updateFragment('bar').then(() => {
      expect(replaceStateSpy).to.be.calledOnce;
      expect(replaceStateSpy.lastCall.args).to.jsonEqual([{}, '', '#bar']);
    });
  });

  it('should get fragment from the viewer on Virtual ' +
      'if the viewer has capability of getting fragment', () => {
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingVirtual_(env.win, viewer));
    viewerMock.expects('hasCapability').withExactArgs('fragment').once()
        .returns(true);
    viewerMock.expects('sendMessageAwaitResponse').withExactArgs('getFragment',
        undefined, true).once().returns(Promise.resolve('from-viewer'));
    return history.getFragment().then(fragment => {
      expect(fragment).to.equal('from-viewer');
    });
  });

  it('should NOT get fragment from the viewer on Virtual ' +
      'if the viewer does NOT have capability of getting fragment', () => {
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingVirtual_(env.win, viewer));
    viewerMock.expects('hasCapability').withExactArgs('fragment').once()
        .returns(false);
    return history.getFragment().then(fragment => {
      expect(fragment).to.equal('');
    });
  });

  it('should NOT get fragment from the viewer on Virtual ' +
      'if the viewer does NOT return a fragment', () => {
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingVirtual_(env.win, viewer));
    viewerMock.expects('hasCapability').withExactArgs('fragment').once()
        .returns(true);
    viewerMock.expects('sendMessageAwaitResponse').withExactArgs('getFragment',
        undefined, true).once().returns(Promise.resolve());
    return history.getFragment().then(fragment => {
      expect(fragment).to.equal('');
    });
  });

  it('should update fragment of the viewer on Virtual ' +
      'if the viewer has capability of updating fragment', () => {
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingVirtual_(env.win, viewer));
    viewerMock.expects('hasCapability').withExactArgs('fragment').once()
        .returns(true);
    let called = false;
    viewer.sendMessageAwaitResponse = function(action, data) {
      expect(action).to.equal('replaceHistory');
      expect(data.fragment).to.equal('fragment');
      called = true;
      return Promise.resolve();
    };
    return history.updateFragment('fragment').then(() => {
      expect(called).to.be.ok;
    });
  });

  it('should NOT update fragment of the viewer on Virtual ' +
      'if the viewer does NOT have capability of updating fragment', () => {
    history = new History(new AmpDocSingle(env.win),
        new HistoryBindingVirtual_(env.win, viewer));
    viewerMock.expects('hasCapability').withExactArgs('fragment').once()
        .returns(false);
    viewerMock.expects('sendMessageAwaitResponse').withExactArgs(
        'replaceHistory', {fragment: 'fragment'}, true).never();
    return history.updateFragment('fragment').then(() => {});
  });
});
