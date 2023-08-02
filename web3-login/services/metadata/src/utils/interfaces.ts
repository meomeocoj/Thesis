export const TKEY = "tkey";

const DBTableMap = {
  [TKEY]: TKEY,
};

export type DBTableName = keyof typeof DBTableMap;

export interface Data {
  id: string;
  created_at: Date;
  updated_at: Date;
  key: string;
  value: string;
}

export type DataInsertType = Omit<Data, "id" | "created_at" | "updated_at">;
export type DataUpdateType = Omit<Data, "id" | "created_at" | "updated_at" | "key">;

export interface SetDataData {
  data: string;
  timestamp: string;
}

export interface SetDataInput {
  namespace?: string;
  pub_key_X: string;
  pub_key_Y: string;
  set_data: SetDataData;
  tableName?: DBTableName;
  signature: string;
}

export interface LockDataInput {
  key: string;
  signature: string;
  data: Partial<SetDataData> & Pick<SetDataData, "timestamp">;
}

export const getDBTableName = (namespace: string) => {
  // eslint-disable-next-line security/detect-object-injection
  const table = DBTableMap[namespace];
  return table;
};
