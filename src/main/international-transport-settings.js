'use strict';

const SETTING_KEY = 'international_transport_zero_rate_enabled';
const SETTING_ERRORS = Object.freeze({
  PRIMARY_REQUIRED: 'INTERNATIONAL_TRANSPORT_PRIMARY_REQUIRED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'SETTINGS_PERMISSION_REQUIRED',
  SAVE_FAILED: 'INTERNATIONAL_TRANSPORT_SETTING_SAVE_FAILED',
});

function permissionErrorResult(error) {
  const code = error && error.code;
  return {
    ok: false,
    error: code === 'AUTH_REQUIRED' ? SETTING_ERRORS.AUTH_REQUIRED : SETTING_ERRORS.FORBIDDEN,
  };
}

async function persistTransition(conn, enabled, actor) {
  const nextValue = enabled ? 1 : 0;
  const [rows] = await conn.query(
    'SELECT international_transport_zero_rate_enabled FROM app_settings WHERE id=1 FOR UPDATE'
  );
  const currentValue = rows[0] && rows[0].international_transport_zero_rate_enabled ? 1 : 0;
  if (currentValue === nextValue) return false;

  await conn.query(
    'UPDATE app_settings SET international_transport_zero_rate_enabled=? WHERE id=1',
    [nextValue]
  );
  await conn.query(
    `INSERT INTO settings_audit_log
      (setting_key, old_value, new_value, created_by_user_id, created_by_user_name)
      VALUES (?, ?, ?, ?, ?)`,
    [SETTING_KEY, String(currentValue), String(nextValue), actor.id, actor.full_name || actor.username]
  );
  return true;
}

function createInternationalTransportSettingService(dependencies) {
  const deps = dependencies;

  async function set(event, enabled) {
    if (deps.isSecondaryDevice()) {
      return { ok: false, error: SETTING_ERRORS.PRIMARY_REQUIRED };
    }

    const actor = deps.authenticatedUserForEvent(event);
    if (!actor) return { ok: false, error: SETTING_ERRORS.AUTH_REQUIRED };
    try {
      await deps.assertPermission(event, 'settings.update');
    } catch (error) {
      return permissionErrorResult(error);
    }

    return saveAndBroadcast(Boolean(enabled), actor);
  }

  async function saveAndBroadcast(enabled, actor) {
    let conn;
    try {
      conn = await deps.getConnection();
      await conn.beginTransaction();
      const changed = await persistTransition(conn, enabled, actor);
      await conn.commit();
      if (changed) deps.broadcast({ international_transport_zero_rate_enabled: enabled });
      return { ok: true, changed, enabled };
    } catch (error) {
      if (conn) await conn.rollback();
      deps.logger.error('Failed to update international transport setting', error);
      return { ok: false, error: SETTING_ERRORS.SAVE_FAILED };
    } finally {
      if (conn) conn.release();
    }
  }

  return { set };
}

module.exports = {
  SETTING_KEY,
  SETTING_ERRORS,
  createInternationalTransportSettingService,
};
