
module.exports = {

  // TODO - wrape page_landing in this
  page_wrapper : `
<html>
<head>
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" crossorigin="anonymous">
</head>
<body>


<div class='container'>
  <h1>{{name}} - Documentation</h1>
  {{{innerhtml}}}
</div>

  <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js"                          crossorigin="anonymous"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"       crossorigin="anonymous"></script>
</body>
</html>
`,

  page_landing : `
  <html>
  <head>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" crossorigin="anonymous">
  </head>
  <body>
  
  <div class='container'>
    <div><a href='{{root}}/doc' class='btn btn-primary'>back</a></div>
  
    <h1>{{route}}</h1>
  
    <blockquote>{{summary}}</blockquote>
  
    <p><strong>Path Description</strong>: {{{desc}}}</p>
  
    {{#if docs}}
    <div class='wov-docs'>
    {{#each docs}}
      <dt>Document: <a href="{{link}}" target="_blank">{{title}}</a></dt>
      <dd>{{description}}</dd>
    {{/each}}
    </div> <!-- end wov-docs -->
    {{/if}}
  
    {{#if params}}
    <div class='container-params'>
    {{#each params}}
      <dt>Param: {{name}}{{#if in}} - in {{in}}{{/if}}{{#if required}}<strong> (required)</strong><br />{{/if}}</dt>
      <dd>{{desc}}</dd>
    {{/each}}
    </div>
    {{/if}}

    <hr />
  
    <div class='container container-methods'>
      {{#each methods}}
      <div class='card'>
  
        <div class='card-body'>
          <h2><span style='text-transform: uppercase;'>{{@key}}</span> : {{#if funcname}}{{funcname}}{{else}}(unnamed){{/if}}</h2>
          <p><i>{{summary}}</i></p>
          {{#if funcname}}<div><strong>Function</strong>: {{funcname}} {{#if filename}}in {{filename}}{{/if}}</div>{{/if}}
          {{#if desc}}<div><strong>Description</strong>: {{desc}}</div>{{/if}}
  
          {{#if docs}}
          <div class='wov-docs'>
          {{#each docs}}
            <dt>Document: <a href="{{link}}" target="_blank">{{title}}</a></dt>
            <dd>{{description}}</dd>
          {{/each}}
          </div> <!-- end wov-docs -->
          {{/if}}
  
          {{#if params}}
          <div class='wov-params'>
          {{#each params}}
            {{{docParam this 'Param'}}}
          {{/each}}
          </div> <!-- ends wov-params -->
          {{/if}}
  
          {{#if paramspost.length}}
          <div class='wov-params'>
          {{#each paramspost}}
            {{{docParam this 'PostParam'}}}
          {{/each}}
          </div> <!-- ends wov-params -->
          {{/if}}
  
          {{#if responses.length}}
          <div>

            <p><strong>Responses</strong></p>

            {{#each responses}}

            <div class="card" sstyle="margin-left: 7px">
              <div><strong>{{name}}</strong>: {{resptype}}</div>
              {{#if desc}}<div>{{desc}}</div>{{/if}}

              <!-- check params -->
              {{#if attributes}}
              <div style="margin-left: 7px">
                <div class='wov-params'>
                {{#each attributes}}
                  {{{docParam this 'Param'}}}
                {{/each}}
                </div>
              </div>
              {{/if}}

              <!-- example -->
              {{#if example}}
              <div><strong>example:</strong></div>
              {{{JSON example}}}
              {{/if}}

            {{/each}}

          </div>
          {{/if}}
        </div> <!-- ends card body-->
  
      </div> <!-- ends method - card -->
      {{/each}}
    </div> <!-- ends container-methods -->

    <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js"                        crossorigin="anonymous"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"       crossorigin="anonymous"></script>
  
  </body>
  </html>
`,
  page_endpoint : `
<div>
  <div>
  {{#if hasPage}}<a href='{{docroute}}'>{{/if}}{{route}} - {{#each vlist}}{{/each}}{{#if hasPage}}</a>{{/if}}
  {{#if summary}}
  <div style='margin-left: 15px'><i>{{summary}}</i></div>
  {{/if}}
  <ul style='list-style-type: none'>
  {{#each node.methods}}<li><i>{{#if funcname}}{{funcname}}{{else}}(unnamed){{/if}} - {{upper verb}}{{#if summary}} - {{summary}}{{/if}}</  i></li>{{/each}}
  </ul>
</div>
  `,
};
