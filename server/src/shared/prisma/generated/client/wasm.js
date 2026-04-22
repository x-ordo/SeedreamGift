
Object.defineProperty(exports, "__esModule", { value: true });

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  NotFoundError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  skip,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  getRuntime
} = require('./runtime/wasm.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.NotFoundError = NotFoundError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}





/**
 * Enums
 */
exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable',
  Snapshot: 'Snapshot'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  phone: 'phone',
  role: 'role',
  kycStatus: 'kycStatus',
  kycData: 'kycData',
  customLimitPerTx: 'customLimitPerTx',
  customLimitPerDay: 'customLimitPerDay',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  brand: 'brand',
  name: 'name',
  description: 'description',
  price: 'price',
  discountRate: 'discountRate',
  buyPrice: 'buyPrice',
  tradeInRate: 'tradeInRate',
  allowTradeIn: 'allowTradeIn',
  imageUrl: 'imageUrl',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VoucherCodeScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  pinCode: 'pinCode',
  status: 'status',
  orderId: 'orderId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  totalAmount: 'totalAmount',
  status: 'status',
  paymentMethod: 'paymentMethod',
  paymentKey: 'paymentKey',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  productId: 'productId',
  quantity: 'quantity',
  price: 'price'
};

exports.Prisma.TradeInScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  productId: 'productId',
  pinCode: 'pinCode',
  bankName: 'bankName',
  accountNum: 'accountNum',
  accountHolder: 'accountHolder',
  payoutAmount: 'payoutAmount',
  status: 'status',
  adminNote: 'adminNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CartItemScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  productId: 'productId',
  quantity: 'quantity',
  createdAt: 'createdAt'
};

exports.Prisma.SiteConfigScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  type: 'type',
  description: 'description',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Product: 'Product',
  VoucherCode: 'VoucherCode',
  Order: 'Order',
  OrderItem: 'OrderItem',
  TradeIn: 'TradeIn',
  CartItem: 'CartItem',
  SiteConfig: 'SiteConfig'
};
/**
 * Create the Client
 */
const config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client-js"
    },
    "output": {
      "value": "C:\\Dev\\httrack_download_pages\\wow-gift\\server\\src\\shared\\prisma\\generated\\client",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "windows",
        "native": true
      }
    ],
    "previewFeatures": [
      "driverAdapters"
    ],
    "sourceFilePath": "C:\\Dev\\httrack_download_pages\\wow-gift\\server\\prisma\\schema.prisma",
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": null,
    "schemaEnvPath": "../../../../../.env"
  },
  "relativePath": "../../../../../prisma",
  "clientVersion": "5.22.0",
  "engineVersion": "605197351a3c8bdd595af2d2a9bc3025bca48ea2",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "sqlserver",
  "postinstall": false,
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": "generator client {\n  provider        = \"prisma-client-js\"\n  output          = \"../src/shared/prisma/generated/client\"\n  previewFeatures = [\"driverAdapters\"]\n}\n\ndatasource db {\n  provider = \"sqlserver\"\n  url      = env(\"DATABASE_URL\")\n}\n\n// ==========================================================\n// 1. 사용자 및 인증 (User & Auth)\n// ==========================================================\n\nmodel User {\n  id       Int     @id @default(autoincrement())\n  email    String  @unique\n  password String\n  name     String?\n  phone    String? @unique\n\n  // Roles: 'USER', 'PARTNER', 'ADMIN'\n  role String @default(\"USER\")\n\n  // KYC: 'NONE', 'PENDING', 'VERIFIED', 'REJECTED'\n  kycStatus String  @default(\"NONE\")\n  kycData   String? @db.Text // JSON: { \"idImage\": \"...\", \"realName\": \"...\" }\n\n  // Limits (Null = Use Global Defaults)\n  customLimitPerTx  Decimal? @db.Decimal(10, 2)\n  customLimitPerDay Decimal? @db.Decimal(10, 2)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  orders   Order[]\n  tradeIns TradeIn[]\n  cart     CartItem[]\n\n  // Best Practice: 자주 필터링되는 컬럼에 인덱스\n  @@index([role])\n  @@index([kycStatus])\n  @@map(\"users\")\n}\n\n// ==========================================================\n// 2. 상품 (Product - Gift Certificates)\n// ==========================================================\n\nmodel Product {\n  id          Int     @id @default(autoincrement())\n  brand       String // 'SHINSEGAE', 'LOTTE', 'HYUNDAI', 'CULTURELAND', etc.\n  name        String\n  description String? @db.Text\n\n  // Pricing\n  price        Decimal @db.Decimal(10, 2) // Face Value (e.g., 100,000)\n  discountRate Float   @default(0) // Buy Discount (e.g., 2.5%)\n  buyPrice     Decimal @db.Decimal(10, 2) // Calculated: price * (1 - discountRate)\n\n  // Trade-In (Sell to Platform) Settings\n  tradeInRate  Float   @default(0) // Sell Discount (e.g., 5.0%)\n  allowTradeIn Boolean @default(false)\n\n  imageUrl String?\n  isActive Boolean @default(true)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  orderItems   OrderItem[]\n  cartItems    CartItem[]\n  voucherCodes VoucherCode[]\n  tradeIns     TradeIn[]\n\n  // Best Practice: 자주 필터링되는 컬럼에 인덱스\n  @@index([brand])\n  @@index([isActive])\n  @@index([brand, isActive]) // 복합 인덱스: 브랜드별 활성 상품 조회\n  @@map(\"products\")\n}\n\n// ==========================================================\n// 3. 재고 관리 (Inventory - Voucher Codes)\n// ==========================================================\n\nmodel VoucherCode {\n  id        Int     @id @default(autoincrement())\n  productId Int\n  product   Product @relation(fields: [productId], references: [id])\n\n  pinCode String @db.NVarChar(500) // Encrypted\n  status  String @default(\"AVAILABLE\") // 'AVAILABLE', 'SOLD', 'USED', 'EXPIRED'\n\n  orderId Int?\n  order   Order? @relation(fields: [orderId], references: [id])\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([productId, status])\n  @@index([orderId]) // Added Optimization\n  @@map(\"voucher_codes\")\n}\n\n// ==========================================================\n// 4. 구매 주문 (Buying Flow: User -> Platform)\n// ==========================================================\n\nmodel Order {\n  id     Int  @id @default(autoincrement())\n  userId Int\n  user   User @relation(fields: [userId], references: [id])\n\n  totalAmount Decimal @db.Decimal(10, 2)\n  status      String  @default(\"PENDING\") // 'PENDING', 'PAID', 'DELIVERED', 'CANCELLED'\n\n  paymentMethod String? // 'CARD', 'VIRTUAL_ACCOUNT'\n  paymentKey    String? // PG Key\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  items        OrderItem[]\n  voucherCodes VoucherCode[]\n\n  // Best Practice: 외래키 및 자주 조회되는 컬럼에 인덱스\n  @@index([userId])\n  @@index([status])\n  @@index([createdAt])\n  @@map(\"orders\")\n}\n\nmodel OrderItem {\n  id      Int   @id @default(autoincrement())\n  orderId Int\n  order   Order @relation(fields: [orderId], references: [id])\n\n  productId Int\n  product   Product @relation(fields: [productId], references: [id])\n\n  quantity Int\n  price    Decimal @db.Decimal(10, 2) // Price at moment of purchase\n\n  // Best Practice: 외래키 인덱스\n  @@index([orderId])\n  @@index([productId])\n  @@map(\"order_items\")\n}\n\n// ==========================================================\n// 5. 판매 신청 (Selling Flow: User -> Platform)\n// ==========================================================\n\nmodel TradeIn {\n  id     Int  @id @default(autoincrement())\n  userId Int\n  user   User @relation(fields: [userId], references: [id])\n\n  productId Int\n  product   Product @relation(fields: [productId], references: [id])\n\n  pinCode       String  @db.Text // User submitted PIN\n  bankName      String?\n  accountNum    String?\n  accountHolder String?\n\n  payoutAmount Decimal @db.Decimal(10, 2)\n  status       String  @default(\"REQUESTED\") // 'REQUESTED', 'VERIFIED', 'PAID', 'REJECTED'\n\n  adminNote String?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  // Best Practice: 외래키 및 자주 조회되는 컬럼에 인덱스\n  @@index([userId])\n  @@index([productId])\n  @@index([status])\n  @@index([createdAt])\n  @@map(\"trade_ins\")\n}\n\n// ==========================================================\n// 6. 장바구니 (Cart)\n// ==========================================================\n\nmodel CartItem {\n  id        Int      @id @default(autoincrement())\n  userId    Int\n  user      User     @relation(fields: [userId], references: [id])\n  productId Int\n  product   Product  @relation(fields: [productId], references: [id])\n  quantity  Int      @default(1)\n  createdAt DateTime @default(now())\n\n  // Best Practice: 외래키 인덱스 및 유니크 제약\n  @@unique([userId, productId]) // 같은 상품 중복 방지\n  @@index([userId])\n  @@map(\"cart_items\")\n}\n\n// ==========================================================\n// 7. 시스템 설정 (System Config)\n// ==========================================================\n\nmodel SiteConfig {\n  id          Int     @id @default(autoincrement())\n  key         String  @unique // e.g., 'GLOBAL_LIMIT_PER_DAY', 'NOTICE_BANNER'\n  value       String  @db.Text\n  type        String // 'STRING', 'NUMBER', 'JSON', 'BOOLEAN'\n  description String?\n\n  updatedAt DateTime @updatedAt\n\n  @@map(\"site_configs\")\n}\n",
  "inlineSchemaHash": "9c830b884f72b117fe68ca54d4a57be423e00c3cc9ee7915cacf11407276dfde",
  "copyEngine": true
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"User\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"password\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"phone\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"role\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"kycStatus\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"kycData\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"customLimitPerTx\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"customLimitPerDay\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"orders\",\"kind\":\"object\",\"type\":\"Order\",\"relationName\":\"OrderToUser\"},{\"name\":\"tradeIns\",\"kind\":\"object\",\"type\":\"TradeIn\",\"relationName\":\"TradeInToUser\"},{\"name\":\"cart\",\"kind\":\"object\",\"type\":\"CartItem\",\"relationName\":\"CartItemToUser\"}],\"dbName\":\"users\"},\"Product\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"brand\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"price\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"discountRate\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"buyPrice\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"tradeInRate\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"allowTradeIn\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"imageUrl\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"isActive\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"orderItems\",\"kind\":\"object\",\"type\":\"OrderItem\",\"relationName\":\"OrderItemToProduct\"},{\"name\":\"cartItems\",\"kind\":\"object\",\"type\":\"CartItem\",\"relationName\":\"CartItemToProduct\"},{\"name\":\"voucherCodes\",\"kind\":\"object\",\"type\":\"VoucherCode\",\"relationName\":\"ProductToVoucherCode\"},{\"name\":\"tradeIns\",\"kind\":\"object\",\"type\":\"TradeIn\",\"relationName\":\"ProductToTradeIn\"}],\"dbName\":\"products\"},\"VoucherCode\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"productId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"product\",\"kind\":\"object\",\"type\":\"Product\",\"relationName\":\"ProductToVoucherCode\"},{\"name\":\"pinCode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"orderId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"order\",\"kind\":\"object\",\"type\":\"Order\",\"relationName\":\"OrderToVoucherCode\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":\"voucher_codes\"},\"Order\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"OrderToUser\"},{\"name\":\"totalAmount\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"status\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"paymentMethod\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"paymentKey\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"items\",\"kind\":\"object\",\"type\":\"OrderItem\",\"relationName\":\"OrderToOrderItem\"},{\"name\":\"voucherCodes\",\"kind\":\"object\",\"type\":\"VoucherCode\",\"relationName\":\"OrderToVoucherCode\"}],\"dbName\":\"orders\"},\"OrderItem\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"orderId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"order\",\"kind\":\"object\",\"type\":\"Order\",\"relationName\":\"OrderToOrderItem\"},{\"name\":\"productId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"product\",\"kind\":\"object\",\"type\":\"Product\",\"relationName\":\"OrderItemToProduct\"},{\"name\":\"quantity\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"price\",\"kind\":\"scalar\",\"type\":\"Decimal\"}],\"dbName\":\"order_items\"},\"TradeIn\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"TradeInToUser\"},{\"name\":\"productId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"product\",\"kind\":\"object\",\"type\":\"Product\",\"relationName\":\"ProductToTradeIn\"},{\"name\":\"pinCode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"bankName\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"accountNum\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"accountHolder\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"payoutAmount\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"status\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"adminNote\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":\"trade_ins\"},\"CartItem\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"CartItemToUser\"},{\"name\":\"productId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"product\",\"kind\":\"object\",\"type\":\"Product\",\"relationName\":\"CartItemToProduct\"},{\"name\":\"quantity\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":\"cart_items\"},\"SiteConfig\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"key\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"value\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":\"site_configs\"}},\"enums\":{},\"types\":{}}")
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.engineWasm = {
  getRuntime: () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const loader = (await import('#wasm-engine-loader')).default
    const engine = (await loader).default
    return engine 
  }
}

config.injectableEdgeEnv = () => ({
  parsed: {
    DATABASE_URL: typeof globalThis !== 'undefined' && globalThis['DATABASE_URL'] || typeof process !== 'undefined' && process.env && process.env.DATABASE_URL || undefined
  }
})

if (typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined) {
  Debug.enable(typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined)
}

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

