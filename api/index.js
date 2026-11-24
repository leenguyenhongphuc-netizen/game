// Hàm serverless của Vercel. Tệp server/dist/handler.cjs được tạo bởi `npm run build:api`.
import bundle from '../server/dist/handler.cjs';

export default bundle.default ?? bundle;
