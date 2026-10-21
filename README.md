# Diagnóstico do Strategy OS

Aplicação React Flow publicada como experiência principal do Strategy OS em `/editor/`.

## Desenvolvimento

```bash
npm ci --cache /tmp/strategy-os-npm-cache
npm run dev
npm run typecheck
npm run build
```

O build é gravado em `../editor/` para publicação estática pelo GitHub Pages. Não edite manualmente os assets gerados.

## Dados

O diagnóstico usa a chave local `strategyos-strategic-map-v1` e o documento versão 2. `matrixType` distingue estruturas econômicas, medidas econômicas, unidades de negócio e diagnósticos. Um diagnóstico guarda `measureId`, `businessUnitId` e a categoria `ambition` ou `objection`. `cascadeOrder` controla a ordem da linha ou coluna e `parentBlockId` liga obrigatoriamente uma medida à sua estrutura. O carregador converte documentos anteriores sem apagar a chave local.

## Teste de navegador

Na raiz do repositório:

```bash
node tests/react-flow-editor.cjs
```

O teste cobre os três eixos estruturais, centralização do pai no intervalo dos filhos, expansão e recolhimento com compactação vertical, diagnósticos nas interseções, categorias e cores, sobreposição permitida de setas, saída pela direita, entrada superior nas unidades de negócio, contato perpendicular, persistência e fluxo em desktop e viewport móvel.
