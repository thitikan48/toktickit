// Pure rules shared by routes and tests.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt ignores bytes after 72

/**
 * Returns an error message when the new password breaks the policy,
 * or null when it is acceptable. Whitespace is not trimmed.
 */
export function validateNewPassword(
  newPassword: unknown,
  currentPassword?: string
): string | null {
  if (typeof newPassword !== "string") {
    return "New password is required.";
  }

  if (
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (
    !/[A-Za-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    return "Password must contain at least one letter and one digit.";
  }

  if (
    currentPassword !== undefined &&
    newPassword === currentPassword
  ) {
    return "New password must be different from the current password.";
  }

  return null;
}
