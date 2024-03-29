export const checkPidExists = (pid: number): boolean => {
  try {
    return process.kill(pid, 0);
  } catch (e) {
    return e.code === 'EPERM';
  }
};
