declare const __BUILD_ID__: string | undefined;

/** O commit desta versão do app (definido no build); `dev` fora dele. */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
