# SDLE Second Assignment

SDLE Second Assignment of group T03G16.

Group members:

1. Afonso Vaz Osório (up202108700@up.pt)
2. João Cardoso (up202108732@up.pt)
3. &lt;first name&gt; &lt;family name&gt; (&lt;email address&gt;)
4. &lt;first name&gt; &lt;family name&gt; (&lt;email address&gt;)

## Execution

Node.js is required to run this project. After installing the dependencies in the `src/` folder by running `npm install`, the code can be executed in multiple ways, such as running the compiled JavaScript after using `tsc`, or by directly using `npx tsx <filename>`. We have included `tsx` in the project's dependencies.

For the client, run `main.ts`.

For the cloud, run `threads/broker.ts`.

While the cloud is running, some of the provided scripts can be used to trigger changes in ring membership. These are `threads/killer.ts` and `threads/adder.ts`. Note that `threads/killer.ts` requires the node's ID to be written in the code. This ID can be obtained by observing the server's logs or by taking a look at its persistent storage.

To run the test option that requires a file path, you must provide the path to the json file that has a "commands" array with commands in it. To run the large scale tests, there is an option on the program that explains how to proceed. Keep note that the large scale testing can only be done again if the server storage json files are deleted.

The program allows the user to enter debug mode so he can analyse the logs. If you wish to jump to a certain part of the logs you can use the jump command with the number that appears in the beggining of each action in the logs.
