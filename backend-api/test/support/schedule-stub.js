/* Integration-project stand-in for @nestjs/schedule (ESM-only, which Jest cannot parse). Wired by moduleNameMapper in jest.config.js for the `int` project ONLY.
 * Integration tests never rely on timers: cron jobs are invoked directly by the tests, so the decorator is a no-op and the module adds nothing.
 * Runtime code is untouched; production still loads the real package. Keep the exports in step with what src/ imports (Cron, CronExpression, ScheduleModule). */
const CronExpression = { EVERY_30_SECONDS: '*/30 * * * * *', EVERY_HOUR: '0 0-23/1 * * *', EVERY_DAY_AT_6AM: '0 06 * * *' };
const Cron = () => () => undefined;
class ScheduleModule { static forRoot() { return { module: ScheduleModule }; } }
module.exports = { Cron, CronExpression, ScheduleModule };
