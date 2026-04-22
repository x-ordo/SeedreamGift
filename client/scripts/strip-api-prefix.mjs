/**
 * Swagger spec 전처리: /api prefix 제거
 *
 * NestJS의 globalPrefix('api')로 인해 Swagger 경로에 /api가 포함됨.
 * 클라이언트의 axiosInstance가 이미 baseURL='/api'를 설정하므로,
 * 생성된 API 경로에서 /api prefix를 제거해야 이중 prefix 방지.
 */
import { readFileSync, writeFileSync } from 'fs';

const specPath = process.argv[2] || 'swagger-spec.json';

const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const newPaths = {};
for (const [path, value] of Object.entries(spec.paths)) {
  const stripped = path.startsWith('/api') ? path.slice(4) : path;
  newPaths[stripped || '/'] = value;
}
spec.paths = newPaths;

writeFileSync(specPath, JSON.stringify(spec, null, 2));
console.log(`Stripped /api prefix from ${Object.keys(newPaths).length} paths`);
