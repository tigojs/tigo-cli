/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import sqlite from 'sqlite3';

class SqlitePromises {
  db: sqlite.Database | null;
  constructor() {
    this.db = null;
  }
  connect(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db = new sqlite.Database(path, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
  run(sql: string, params: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('No available database instance.'));
      }
      this.db.run(sql, params, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('No available database instance.'));
      }
      this.db.exec(sql, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
  get(sql: string, params: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('No available database instance.'));
      }
      this.db.get(sql, params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }
  all(sql: string, params: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('No available database instance.'));
      }
      this.db.all(sql, params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }
  // 关闭数据库
  close() {
    if (!this.db) {
      throw new Error('No available database instance.');
    }
    this.db.close();
  }
  getInstance() {
    return this.db;
  }
}

export default SqlitePromises;
