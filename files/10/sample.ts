interface User {
  id: number;
  name: string;
  email: string;
}

function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}

const alice: User = { id: 1, name: "Alice", email: "alice@example.com" };
const message = greetUser(alice);
console.log(message);
