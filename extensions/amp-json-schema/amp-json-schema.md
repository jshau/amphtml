<!--
Copyright 2018 The AMP HTML Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS-IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# <a name="`amp-json-schema`"></a> `amp-json-schema`

<table>
  <tr>
    <td width="40%"><strong>Description</strong></td>
    <td>This extension allows the user to  specify a JSON schema and validate it using the AJV third_party lib.</td>
  </tr>
  <tr>
    <td width="40%"><strong>Required Script</strong></td>
    <td><code>&lt;script async custom-element="amp-form" src="https://cdn.ampproject.org/v0/amp-json-schema-0.1.js">&lt;/script></code></td>
  </tr>
  <tr>
    <td width="40%"><strong>Example</strong></td>
    <td>
      <script id="amp-json-schema-premutate" type="application/json">
        {
          "type": "object",
          "properties": {
            "numTickets": {
              "type": "integer",
            },
          },
          "required": ["numTickets"],
          "additionalProperties": false
        }
      </script>
    </td>
  </tr>
</table>

## Overview
This extension was created primarily to validate the the amp-bind premutate operation.
When the amp document is first loaded, it can set the amp-state
through an optional premutate operation.

A [JSON Schema](https://json-schema.org/) defines what form the state you pass in
must look like. You can specify which fields are allowed, and which fields are
required.

You can think of it as a way to forcefully constrain the initial state of the app.
If schema validation fails, the page will not load, showing an error instead.

## Validation
See [amp-json-schema rules](https://github.com/ampproject/amphtml/blob/master/extensions/amp-json-schema/validator-amp-json-schema.protoascii) in the AMP validator specification.
