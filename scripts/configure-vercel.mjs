import { writeFile } from 'node:fs/promises';
const input = process.argv[2];
if (!input) throw new Error('Truyền URL HTTPS của Worker: npm run configure:vercel -- https://...');
const url = new URL(input);
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw new Error('Cần URL gốc HTTPS, không có thông tin đăng nhập, đường dẫn, query hoặc fragment.');
}
const config = {
  buildCommand: 'npm run build:frontend',
  outputDirectory: 'dist/client',
  rewrites: [
    { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
    { source: '/:path*', destination: '/index.html' },
  ],
};
await writeFile('vercel.json', JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log('Đã tạo vercel.json với địa chỉ Worker được cung cấp.');
