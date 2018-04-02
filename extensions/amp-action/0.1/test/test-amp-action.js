import {ActionInvocation} from '../../../../src/service/action-impl';
import {ActionService} from '../amp-action';
import {Services} from '../../../../src/services';

describes.fakeWin('ActionService', {
  amp: true,
  location: 'https://pub.com/doc1',
}, env => {
  let document;
  let ampdoc;
  let element;

  beforeEach(() => {
    ampdoc = env.ampdoc;
    document = env.win.document;

    element = document.createElement('script');
    element.setAttribute('id', 'amp-action');
    element.setAttribute('type', 'application/json');
    document.body.appendChild(element);
  });

  it('should disable service when no config', () => {
    document.body.removeChild(element);
    const service = new ActionService(ampdoc);
    expect(service.enabled_).to.be.false;
    expect(service.actionElement_).to.be.undefined;
  });

  it('should fail if config is malformed', () => {
    expect(() => {
      new ActionService(ampdoc);
    }).to.throw(Error);
  });

  it('should send the config to the viewer', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new ActionService(ampdoc);
    expect(service.enabled_).to.be.true;
    expect(service.actionElement_).to.equal(element);
    const sendMessageStub = sandbox.stub(service.viewer_, 'sendMessage');
    service.start_();
    expect(sendMessageStub).to.be.calledOnce;
    expect(sendMessageStub.firstCall.args[0]).to.equal('actionConfig');
    expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
      'config': config,
    });
  });

  it('should send orderCompleted to the viewer', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new ActionService(ampdoc);
    const sendMessageStub = sandbox.stub(service.viewer_, 'sendMessage');
    const order = {
      'foo': 'bar',
    };
    const invocation = new ActionInvocation(element, 'orderCompleted', order);
    service.actionHandler_(invocation);
    expect(sendMessageStub).to.be.calledOnce;
    expect(sendMessageStub.firstCall.args[0]).to.equal('orderCompleted');
    expect(sendMessageStub.firstCall.args[1]).to.deep.equal(order);
  });

  it('should fail to send orderCompleted if order is missing', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new ActionService(ampdoc);
    const sendMessageStub = sandbox.stub(service.viewer_, 'sendMessage');
    const invocation = new ActionInvocation(element, 'orderCompleted');
    service.actionHandler_(invocation);
    expect(sendMessageStub).to.not.be.called;
  });

  it('should send handle the signIn action', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new ActionService(ampdoc);
    const sendMessageStub = sandbox.stub(
      service.viewer_, 'sendMessageAwaitResponse');
    sendMessageStub.returns(Promise.reject());
    const invocation = new ActionInvocation(element, 'signIn');
    service.actionHandler_(invocation);
    expect(sendMessageStub).to.be.calledOnce;
    expect(sendMessageStub.firstCall.args[0]).to.equal('requestSignIn');
    expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
      providers: ['actions-on-google-gsi'],
    });
  });

  it('should enable IDENTITY_TOKEN substitution', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new ActionService(ampdoc);
    service.vsync_ = {
      mutate: callback => {
        callback();
      },
    };
    service.start_();
    const sendMessageStub = sandbox.stub(
      service.viewer_, 'sendMessageAwaitResponse');
    sendMessageStub.returns(Promise.resolve('fake_token'));

    const urlReplacements = Services.urlReplacementsForDoc(ampdoc);
    return urlReplacements
        .expandUrlAsync('https://foo.com/bar?access_token=IDENTITY_TOKEN')
        .then((url) => {
          expect(url).to.equal('https://foo.com/bar?access_token=fake_token');
          expect(sendMessageStub).to.be.calledOnce;
          expect(sendMessageStub.firstCall.args[0]).to.equal(
            'getAccessTokenPassive');
          expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
            providers: ['actions-on-google-gsi'],
          });
          expect(document.documentElement).to.have.class(
            'amp-action-identity-available');
          expect(document.documentElement).not.to.have.class(
              'amp-action-identity-unavailable');
        });
  });

  it('should set the css classes if IDENTITY_TOKEN is unavailable', () => {
    const config = {
      'providerId': 'foo-bar',
    };
    element.textContent = JSON.stringify(config);
    const service = new ActionService(ampdoc);
    service.vsync_ = {
      mutate: callback => {
        callback();
      },
    };
    service.start_();
    const sendMessageStub = sandbox.stub(
      service.viewer_, 'sendMessageAwaitResponse');
    sendMessageStub.returns(Promise.reject());

    const urlReplacements = Services.urlReplacementsForDoc(ampdoc);
    return urlReplacements
        .expandUrlAsync('https://foo.com/bar?access_token=IDENTITY_TOKEN')
        .then((url) => {
          expect(url).to.equal('https://foo.com/bar?access_token=');
          expect(sendMessageStub).to.be.calledOnce;
          expect(sendMessageStub.firstCall.args[0]).to.equal(
            'getAccessTokenPassive');
          expect(sendMessageStub.firstCall.args[1]).to.deep.equal({
            providers: ['actions-on-google-gsi'],
          });
          expect(document.documentElement).not.to.have.class(
            'amp-action-identity-available');
          expect(document.documentElement).to.have.class(
              'amp-action-identity-unavailable');
        });
  });
});
