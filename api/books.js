import { json, method, fail } from '../lib/http.js';
import { listBooks } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'GET');
    return json({ books: (await listBooks()).map(({ file, ...book }) => book), demoOnly: true });
  } catch (error) { return fail(error); }
} };
