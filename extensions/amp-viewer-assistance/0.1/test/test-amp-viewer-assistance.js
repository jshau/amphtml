import {ActionInvocation} from '../../../../src/service/action-impl';
import {AmpViewerAssistance} from '../amp-viewer-assistance';
import {Services} from '../../../../src/services';
import {mockServiceForDoc} from '../../../../testing/test-helper';

describes.fakeWin('AmpViewerAssistance', {
  amp: true,
  location: 'https://pub.com/doc1',
}, env => {
  let document;
  let ampdoc;
  let element;
  let viewerMock;

  beforeEach(() => {
    ampdoc = env.ampdoc;
    document = env.win.document;
    viewerMock = mockServiceForDoc(env.sandbox, env.ampdoc, 'viewer', [
      'isTrustedViewer',
      'sendMessage',
      'sendMessageAwaitResponse',
    ]);
    viewerMock.isTrustedViewer.returns(Promise.resolve(true));

    element = document.createElement('script');
    element.setAttribute('id', 'amp-viewer-assistance');
    element.setAttribute('type', 'application/json');
    document.body.appendChild(element);
  });

  it('should disable service when no config', () => {
    document.body.removeChild(element);
    const service = new AmpViewerAssistance(ampdoc);
    expect(service.enabled_).to.be.false;
    expect(service.assistanceElement_).to.be.undefined;
  });

  it('should disable service when the viewer is not trusted', () => {
    viewerMock.isTrustedViewer.returns(Promise.resolve(false));
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    return service.start_().then(() => {
      expect(service.enabled_).to.be.false;
    });
  });

  it('should fail if config is malformed', () => {
    expect(() => {
      new AmpViewerAssistance(ampdoc);
    }).to.throw(Error);
  });

  it('should send the config to the viewer', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    expect(service.enabled_).to.be.true;
    expect(service.assistanceElement_).to.equal(element);
    const sendMessageStub = service.viewer_.sendMessage;
    return service.start_().then(() => {
      expect(sendMessageStub).to.be.calledOnce;
      expect(sendMessageStub.firstCall.args[0]).to
          .equal('viewerAssistanceConfig');
      expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
        'config': config,
      });
    });
  });

  it('should send orderCompleted to the viewer', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    const sendMessageStub = service.viewer_.sendMessage;
    const order = {
      'foo': 'bar',
    };
    return service.start_().then(() => {
      sendMessageStub.reset();
      const invocation = new ActionInvocation(element, 'orderCompleted', order);
      service.actionHandler_(invocation);
      expect(sendMessageStub).to.be.calledOnce;
      expect(sendMessageStub.firstCall.args[0]).to.equal('orderCompleted');
      expect(sendMessageStub.firstCall.args[1]).to.deep.equal(order);
    });
  });

  it('should fail to send orderCompleted if order is missing', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    const sendMessageStub = service.viewer_.sendMessage;
    return service.start_().then(() => {
      sendMessageStub.reset();
      const invocation = new ActionInvocation(element, 'orderCompleted');
      service.actionHandler_(invocation);
      expect(sendMessageStub).to.not.be.called;
    });
  });

  it('should send handle the signIn action', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    const sendMessageStub = service.viewer_.sendMessageAwaitResponse;
    return service.start_().then(() => {
      sendMessageStub.returns(Promise.reject());
      const invocation = new ActionInvocation(element, 'signIn');
      service.actionHandler_(invocation);
      expect(sendMessageStub).to.be.calledOnce;
      expect(sendMessageStub.firstCall.args[0]).to.equal('requestSignIn');
      expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
        providers: ['actions-on-google-gsi'],
      });
    });
  });

  it('should enable IDENTITY_TOKEN substitution', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    service.vsync_ = {
      mutate: callback => {
        callback();
      },
    };
    return service.start_().then(() => {
      const sendMessageStub = service.viewer_.sendMessageAwaitResponse;
      sendMessageStub.returns(Promise.resolve('fake_token'));

      const urlReplacements = Services.urlReplacementsForDoc(ampdoc);
      return urlReplacements
          .expandUrlAsync('https://foo.com/bar?access_token=IDENTITY_TOKEN')
          .then(url => {
            expect(url).to.equal('https://foo.com/bar?access_token=fake_token');
            expect(sendMessageStub).to.be.calledOnce;
            expect(sendMessageStub.firstCall.args[0]).to.equal(
                'getAccessTokenPassive');
            expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
              providers: ['actions-on-google-gsi'],
            });
            expect(document.documentElement).to.have.class(
                'amp-viewer-assistance-identity-available');
            expect(document.documentElement).not.to.have.class(
                'amp-viewer-assistance-identity-unavailable');
          });
    });
  });

  it('should set the css classes if IDENTITY_TOKEN is unavailable', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new AmpViewerAssistance(ampdoc);
    service.vsync_ = {
      mutate: callback => {
        callback();
      },
    };
    return service.start_().then(() => {
      const sendMessageStub = service.viewer_.sendMessageAwaitResponse;
      sendMessageStub.returns(Promise.reject());

      const urlReplacements = Services.urlReplacementsForDoc(ampdoc);
      return urlReplacements
          .expandUrlAsync('https://foo.com/bar?access_token=IDENTITY_TOKEN')
          .then(url => {
            expect(url).to.equal('https://foo.com/bar?access_token=');
            expect(sendMessageStub).to.be.calledOnce;
            expect(sendMessageStub.firstCall.args[0]).to.equal(
                'getAccessTokenPassive');
            expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
              providers: ['actions-on-google-gsi'],
            });
            expect(document.documentElement).not.to.have.class(
                'amp-viewer-assistance-identity-available');
            expect(document.documentElement).to.have.class(
                'amp-viewer-assistance-identity-unavailable');
          });
    });
  });
});
