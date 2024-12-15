# SDLE Second Assignment

SDLE Second Assignment of group T03G16.

Group members:

1. Afonso Vaz Osório (up202108700@up.pt)
2. &lt;first name&gt; &lt;family name&gt; (&lt;email address&gt;)
3. &lt;first name&gt; &lt;family name&gt; (&lt;email address&gt;)
4. &lt;first name&gt; &lt;family name&gt; (&lt;email address&gt;)

## Execution

Node.js is required to run this project. After installing the dependencies in the `src/` folder by running `npm install`, the code can be executed in multiple ways, such as running the compiled JavaScript after using `tsc`, or by directly using `npx tsx <filename>`. We have included `tsx` in the project's dependencies.

For the client, run `main.ts`.

For the cloud, run `threads/broker.ts`.

While the cloud is running, some of the provided scripts can be used to trigger changes in ring membership. These are `threads/killer.ts` and `threads/adder.ts`. Note that `threads/killer.ts` requires the node's ID to be written in the code. This ID can be obtained by observing the server's logs or by taking a look at its persistent storage.