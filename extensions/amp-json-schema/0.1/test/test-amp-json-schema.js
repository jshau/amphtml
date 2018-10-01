import {AmpJsonSchema} from '../amp-json-schema';

describes.fakeWin('AmpJsonSchema', {
  amp: true,
  location: 'https://pub.com/doc1',
}, env => {

  let document;
  let jsonSchemaService;
  beforeEach(() => {
    document = env.win.document;

    const element = document.createElement('script');
    element.setAttribute('id', 'amp-json-schema-premutate');
    element.setAttribute('type', 'application/json');

    const schema = {
      "type": "object",
      "properties": {
          "shoeType": {
              "type": "string"
          }
     },
     "required": ["shoeType"],
     "additionalProperties": false
    };
    element.textContent = JSON.stringify(schema);
    document.body.appendChild(element);
    jsonSchemaService = new AmpJsonSchema(env.ampdoc);

  });

  it('Validate should return true if valid data', () => {
    expect(jsonSchemaService.validate('premutate', {shoeType: 'jordans'})).to.be.true;
  });

  it('Validate should fail if data does not match schema', () => {
    expect(jsonSchemaService.validate('premutate', {cat: 'hat'})).to.be.false;
  });

  it('Validate should fail is schema has not been defined', () => {
    allowConsoleError( ()=>{
      expect(jsonSchemaService.validate('test', {cat: 'hat'})).to.be.false;
    })
  });

  it('Validate should fail if JSON Parse fails', () => {
    const element = document.createElement('script');
    element.setAttribute('id', 'amp-json-schema-test');
    element.setAttribute('type', 'application/json');

    element.textContent = "{asdf";
    document.body.appendChild(element);
    allowConsoleError( ()=>{
      expect(jsonSchemaService.validate('test', {cat: 'hat'})).to.be.false;
    })
  });
});
