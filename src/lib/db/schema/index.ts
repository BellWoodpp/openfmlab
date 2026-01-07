import { users } from "./users";
import * as auth from "./auth";
import * as orders from "./orders";
import * as blogs from "./blogs";
import * as shares from "./shares";
import * as tts from "./tts";

export const schema = {
  users,
  ...auth,
  ...orders,
  ...blogs,
  ...shares,
  ...tts,
};

export type Schema = typeof schema;

export * from "./users";
export * from "./auth";
export * from "./orders";
export * from "./blogs";
export * from "./shares";
export * from "./tts";
