export type ActionSuccess<T> = { success: true; data: T };
export type ActionFailure = { success: false; error: string };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function actionError(message: string): ActionFailure {
  return { success: false, error: message };
}

export function actionOk<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}
