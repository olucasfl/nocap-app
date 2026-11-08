// A Duna carrega sob demanda: os testes da sala a carregam antes de tudo (o servidor faz o mesmo ao subir).
import { fsPreloadMap } from '@nocap/games';

await fsPreloadMap('duna');
