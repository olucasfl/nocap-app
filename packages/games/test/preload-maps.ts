// A Duna carrega sob demanda (dados fora do pacote principal): os testes a carregam antes de tudo.
import { fsPreloadMap } from '../src/foxshot/maps';

await fsPreloadMap('duna');
