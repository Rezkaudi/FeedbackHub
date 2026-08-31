export type DeepStringRecord = {
  readonly [key: string]: string | DeepStringRecord;
};

export type SameShape<T extends DeepStringRecord> = {
  readonly [K in keyof T]: T[K] extends string ? string : SameShape<Extract<T[K], DeepStringRecord>>;
};

export type Leaves<T extends DeepStringRecord, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Leaves<Extract<T[K], DeepStringRecord>, `${Prefix}${K}.`>;
}[keyof T & string];
