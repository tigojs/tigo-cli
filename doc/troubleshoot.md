# Troubleshoot

## Install

### dependency: sqlite3 (node-pre-gyp: Permission denied)

Firstly, you can try `sudo npm install --unsafe-perm @tigojs/cli -g`, if this is not work, you can try to reclaim the `.npm` and the global `node_modules` directory.

```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/lib/node_modules
```

Note: you should replace `/usr/lib/node_modules` with the error `path` in npm log, like `/root/.nvm/versions/node/v14.16.1/lib/node_modules/@tigojs/cli/node_modules/sqlite3`.

This issue may happen when you install your `node` by `nvm` and you're installing `@tigojs/cli` with `root` user.
