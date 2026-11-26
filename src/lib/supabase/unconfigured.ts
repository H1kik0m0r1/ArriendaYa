const CONFIG_ERROR =
  "Backend no configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY, o activa NEXT_PUBLIC_DEMO_MODE=true para modo demostración.";

type QueryResult<T = null> = { data: T; error: { message: string } | null };

interface StubQueryBuilder {
  select: (cols?: string) => StubQueryBuilder;
  insert: (row: unknown) => StubQueryBuilder;
  update: (row: unknown) => StubQueryBuilder;
  delete: () => StubQueryBuilder;
  eq: (col: string, val: unknown) => StubQueryBuilder;
  neq: (col: string, val: unknown) => StubQueryBuilder;
  gte: (col: string, val: unknown) => StubQueryBuilder;
  lte: (col: string, val: unknown) => StubQueryBuilder;
  ilike: (col: string, pattern: string) => StubQueryBuilder;
  in: (col: string, vals: unknown[]) => StubQueryBuilder;
  or: (str: string) => StubQueryBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => StubQueryBuilder;
  limit: (n: number) => StubQueryBuilder;
  range: (from: number, to: number) => StubQueryBuilder;
  maybeSingle: () => Promise<QueryResult<null>>;
  single: () => Promise<QueryResult<null>>;
  then: <TResult1 = QueryResult<null>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
}

function makeStubBuilder(): StubQueryBuilder {
  const result: QueryResult<null> = { data: null, error: { message: CONFIG_ERROR } };
  const builder: StubQueryBuilder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gte: () => builder,
    lte: () => builder,
    ilike: () => builder,
    in: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    maybeSingle: async () => result,
    single: async () => result,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return builder;
}

export function createUnconfiguredClient() {
  return {
    from: () => makeStubBuilder(),
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: CONFIG_ERROR } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: CONFIG_ERROR } }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: CONFIG_ERROR } }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: { message: CONFIG_ERROR } }),
      updateUser: async () => ({ data: { user: null }, error: { message: CONFIG_ERROR } }),
      exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: { message: CONFIG_ERROR } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: CONFIG_ERROR } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        createSignedUrl: async () => ({ data: null, error: { message: CONFIG_ERROR } }),
      }),
    },
  };
}
