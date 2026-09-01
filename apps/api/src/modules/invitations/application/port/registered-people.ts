/**
 * A way to ask whether an address already belongs to a member, without this
 * module touching the `users` table (R-141). The `identity` module answers.
 */
export interface RegisteredPeople {
  isRegistered(email: string): Promise<boolean>;
}

export const REGISTERED_PEOPLE = Symbol('RegisteredPeople');
