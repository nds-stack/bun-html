import { render } from '../src/index.js'

const html = render('<h1>Hello {{name}}!</h1>', { name: 'World' })
console.log(html)

const list = render(
  '<ul>{{#each items}}<li>{{@index}}: {{this}}</li>{{/each}}</ul>',
  { items: ['Apple', 'Banana', 'Cherry'] },
)
console.log(list)

const conditional = render(
  '{{#if show}}<p>Visible</p>{{else}}<p>Hidden</p>{{/if}}',
  { show: true },
)
console.log(conditional)
