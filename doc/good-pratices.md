# Good practices

## Don't explicitly type what TypeScript can infer

Don't annotate the type of an object, or a function (return value,
variable) when TypeScript can infer it automatically from the
implementation.

### Why

A redundant annotation adds noise and a second source of truth: if the
implementation changes, the inferred type follows automatically while the
explicit type has to be updated manually (and can silently stay wrong if the
new value is a compatible subtype).

### Examples

```ts
// Avoid
const user: { id: string; name: string } = { id: "1", name: "Mael" };
function double(x: number): number {
  return x * 2;
}

// Prefer
const user = { id: "1", name: "Mael" };
function double(x: number) {
  return x * 2;
}
```

### When to type explicitly

- Public signature of an exported function whose parameters aren't already
  typed (inference can't guess parameter types).
- The inferred type is wider than intended (e.g. `const status = "active"`
  inferred as `string` instead of the literal expected in a given context)
  — use `as const` or an explicit annotation depending on the case.
- Cases where inference fails or produces `any`/`unknown`.

## Frontend: React Query keys as a factory

Don't write `queryKey`s as literal arrays scattered across the code.
Centralize a resource's keys in a dedicated factory object.

### Why

A centralized factory prevents inconsistencies between the key used by
`useQuery` and the key used by `invalidateQueries`/`setQueryData` elsewhere
in the code, and makes partial invalidations (a whole list, a single detail,
etc.) explicit instead of rebuilt by hand at every call site.

### Example

```ts
export const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, "detail"] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
};

useQuery({ queryKey: todoKeys.list(filters), queryFn: ... });
queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
```

A factory like this should be created per resource (todos, users, etc.),
colocated with that resource's query/mutation hooks.

## Frontend: forms with react-hook-form

Don't manage form state with one `useState` per field and hand-controlled
inputs. Use `react-hook-form` (`useForm`, `register`, `handleSubmit`).

### Why

`react-hook-form` avoids re-renders on every keystroke (inputs are
uncontrolled by default), centralizes validation, and avoids manually
duplicating state (one `useState` per field) that already exists in the
payload sent to the mutation.

### Example

```tsx
interface LoginFormValues {
  email: string;
  password: string;
}

const { register, handleSubmit } = useForm<LoginFormValues>({
  defaultValues: { email: "", password: "" },
});

<form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
  <input {...register("email")} />
  <input type="password" {...register("password")} />
</form>;
```

See `web/src/routes/login.tsx` and `web/src/routes/signup.tsx` for a
complete example, with custom fields (`TextField`, `PasswordField`) that
receive the result of `register(...)` via a `registration` prop instead of
`value`/`onChange`.
