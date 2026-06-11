type SupabaseUntypedQueryResult = {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
};

type SupabaseUntypedQueryBuilder = PromiseLike<SupabaseUntypedQueryResult> &
  SupabaseUntypedQueryResult & {
    select(
      columns?: string,
      options?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
    ): SupabaseUntypedQueryBuilder;
    insert(
      values: unknown,
      options?: {
        count?: "exact" | "planned" | "estimated";
        defaultToNull?: boolean;
      },
    ): SupabaseUntypedQueryBuilder;
    update(values: unknown): SupabaseUntypedQueryBuilder;
    upsert(
      values: unknown,
      options?: {
        onConflict?: string;
        ignoreDuplicates?: boolean;
        count?: "exact" | "planned" | "estimated";
        defaultToNull?: boolean;
      },
    ): SupabaseUntypedQueryBuilder;
    delete(): SupabaseUntypedQueryBuilder;
    eq(column: string, value: unknown): SupabaseUntypedQueryBuilder;
    neq(column: string, value: unknown): SupabaseUntypedQueryBuilder;
    or(filters: string): SupabaseUntypedQueryBuilder;
    in(column: string, values: unknown[]): SupabaseUntypedQueryBuilder;
    is(column: string, value: unknown): SupabaseUntypedQueryBuilder;
    not(column: string, operator: string, value: unknown): SupabaseUntypedQueryBuilder;
    gte(column: string, value: unknown): SupabaseUntypedQueryBuilder;
    lte(column: string, value: unknown): SupabaseUntypedQueryBuilder;
    order(
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean },
    ): SupabaseUntypedQueryBuilder;
    limit(count: number): SupabaseUntypedQueryBuilder;
    maybeSingle(): SupabaseUntypedQueryBuilder;
    single(): SupabaseUntypedQueryBuilder;
  };

type SupabaseUntypedClient = {
  from(table: string): SupabaseUntypedQueryBuilder;
};
