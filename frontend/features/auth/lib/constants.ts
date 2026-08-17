/**
 * Largo mínimo de contraseña.
 *
 * Vive acá y no en una vista porque lo consumen tres cosas que tienen que
 * coincidir: el `minLength` del input, el texto de ayuda que se muestra antes
 * de enviar, y el mensaje de error traducido. Si divergen, le prometemos al
 * usuario una regla y le validamos otra.
 */
export const PASSWORD_MIN_LENGTH = 6;
