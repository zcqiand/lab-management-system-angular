// tests/global-setup.ts — 单测真化基座（REQ-2026-031，移植自
// lab-management-system-react/tests/global-setup.ts，逐段语义 1:1；
// 库身份探针采用 saas-angular 步骤 5 同思路：种子行经服务可见性实证同源）。
//
// 顺序：灌种子 → 起真 nextjs :5201（已健康则复用）→ 铸真 JWT（真验签器闭环）→
// 真服务探针 → 库身份探针。任何一步失败 fail-fast，不许降级 mock。
//
// lab-nextjs 语义备忘（react 仓 task-7 实测，原文照抄）：
//   1. 探活端点：lab-nextjs 真名 /api/health（PG 连通 sanity，body {ok:true}
//      才算健康——裸 200 不够，DATABASE_URL 断链时它自己就 500）。
//   2. 需认证探针：业务路由（/api/contracts 等）挂 tenant guard；铸法正确性
//      用「lab-nextjs 的真验签器 LabJwtSigner.verify 本地闭环验证」+
//      /api/auth/me 无 Bearer 恒 401 的 ADR-0019 负探针双保险。
//   3. LAB_JWT_SECRET/LAB_JWT_ISSUER 先吃 process.env（CI 注入通道；nextjs 仓
//      .env.local gitignored，CI 没有这份文件），缺了再读 sibling .env.local，
//      两头都无 → fail-fast。这是 env 优先级，不是兜底。
//   4. DATABASE_URL 例外（T10-R1①）：只认 process.env，绝不回落 .env.local——
//      该键驱动 seed-db 重灌，顺着 .env.local 跑会 TRUNCATE 真库（saas_dev 事故
//      实证）。缺失立即 fail-fast，不做任何回读。
//   5. 库身份探针：:5201 是家族常驻 dev 端口，可能连着别的库。健康 ≠ 同源——
//      种子行版本有假阳洞（lab_dev 同样有 HT-2026-001，复用进程连着 lab_dev 也会
//      通过）。照 saas-angular 步骤 5 同款：往目标库插一行随机 contract_code 的
//      探针合同（tenant_id 对齐 JWT claim），看服务能否读到，读完即删。
//
// 进程治理：拉起的 nextjs 留活不杀（dev 迭代复用）；PID 记 $TMPDIR，绝不反查杀树。
// DATABASE_URL 只认 process.env（gate L4_DB_INJECT_REPOS 注入，2026-11-01 人裁入表）。
import { execSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANGULAR_ROOT = resolve(HERE, "..");
const SHARED = resolve(ANGULAR_ROOT, "../lab-management-system-shared");
const NEXTJS = resolve(ANGULAR_ROOT, "../lab-management-system-nextjs");
const BASE = "http://localhost:5201";
const NEXTJS_ENV_FILE = resolve(NEXTJS, ".env.local");

/**
 * DATABASE_URL 专用读取：只认 process.env（gate 注入通道），
 * 不回落 sibling .env.local——该键驱动 seed-db 全量重灌，顺着 .env.local 跑
 * 会把重灌打到真库（saas_dev TRUNCATE 事故实证）。缺失立即 fail-fast。
 */
const readDbUrl = (): string => {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl)
    throw new Error(
      "fail-fast: DATABASE_URL 只认 process.env，缺失（禁 .env.local 回落——该键驱动 " +
        "seed-db 全量重灌，回落会误伤真库）。gate 会按 L4_DB_INJECT_REPOS 注入；" +
        "本地裸跑必须显式 export，例：DATABASE_URL=postgresql://… npx --no ng test" +
        "（禁兜底，ADR-0019）",
    );
  return dbUrl;
};

/** env 读取：process.env 优先（CI 注入），回落 sibling .env.local；两头皆无 fail-fast。 */
const readKey = (key: string): string => {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const line = readFileSync(NEXTJS_ENV_FILE, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  if (!line)
    throw new Error(
      `fail-fast: ${key} 未在 process.env / ${NEXTJS_ENV_FILE} 声明（禁兜底，ADR-0019）`,
    );
  return line
    .slice(key.length + 1)
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
};

/** /api/health 健康探针：200 且 body.ok===true 才算过（PG 连通是种子/数据路由前置）。 */
async function healthOk(timeoutMs = 5_000): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok === true;
  } catch {
    return false;
  }
}

/** 轮询直至 deadline（毫秒），每秒一次。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return fn();
}

export default async function ({
  provide,
}: {
  provide: (key: string, value: unknown) => void;
}): Promise<void> {
  const dbUrl = readDbUrl();

  // 1. 种子（upsert 幂等；连 nextjs 同一库，seeds/*.json 是 DB 快照权威源）
  console.log("[global-setup] 1/5 灌种子（shared/scripts/seed-db.mjs upsert）…");
  execSync("node scripts/seed-db.mjs", {
    cwd: SHARED,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  // 2. nextjs :5201——已健康则复用（dev 调试现场），否则拉起 own 进程
  let selfSpawned = false;
  if (!(await healthOk())) {
    console.log("[global-setup] 2/5 :5201 不健康，拉起 own nextjs dev 进程…");
    selfSpawned = true;
    const child = spawn("npm", ["run", "dev"], {
      cwd: NEXTJS,
      stdio: "ignore",
      env: { ...process.env, DATABASE_URL: dbUrl },
      shell: true,
      detached: true,
    });
    if (child.pid) {
      writeFileSync(resolve(tmpdir(), "lab-angular-test-nextjs.pid"), String(child.pid));
    }
    if (!(await waitFor(healthOk, 120_000))) {
      throw new Error(
        `fail-fast: nextjs :5201 /api/health 探活超时（PID ${child.pid ?? "?"}）`,
      );
    }
  } else {
    console.log("[global-setup] 2/5 :5201 已健康，复用现有进程（不重启不杀树）");
  }

  // 3. 铸真 JWT（HS256，claim 形状对齐 lab-nextjs src/lib/auth/jwt.ts 的 JwtClaims：
  //    { sub, iat, exp, typ: "access", iss, tenant_id }；键值现场读，不写任何文件）
  //    tenant_id claim 真源=shared 种子行（react 2026-11-02 竞态真修批同款）：曾硬编码
  //    "TENANT-001"，tenant_key 收口批（2026-11-01）种子迁 acme 后 token×行租户
  //    错位 → 租户过滤全 0 行，列表页 waitFor 空态过但 ⊆ 断言快败（假红主因）。
  const seedReceipts = JSON.parse(
    readFileSync(resolve(SHARED, "seeds/sample_receipts.json"), "utf8"),
  ) as Array<{ tenant_id: string }>;
  const tenantIds = [...new Set(seedReceipts.map((r) => r.tenant_id))];
  if (tenantIds.length !== 1 || !tenantIds[0]) {
    throw new Error(
      `fail-fast: seeds/sample_receipts.json tenant_id 不唯一或为空（${tenantIds.join(",") || "空"}）——token 租户 claim 无真源`,
    );
  }
  const secretText = readKey("LAB_JWT_SECRET");
  const issuer = readKey("LAB_JWT_ISSUER");
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({ tenant_id: tenantIds[0], typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("USER-A")
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secretText));

  // 铸法闭环验证：用 lab-nextjs 的真验签器（生产 verify 语义 = HMAC + iss + exp）
  // 验我们 jose 铸的 token——secret/issuer/claim 任一不符这里 throw。
  // 结构类型标注：sibling 仓不在本仓 tsconfig include 内，不做类型级 import。
  const jwtModule = (await import(
    pathToFileURL(resolve(NEXTJS, "src/lib/auth/jwt.ts")).href
  )) as {
    LabJwtSigner: new (
      secret: string,
      issuer: string,
      accessTtlSeconds: number,
      refreshTtlSeconds: number,
    ) => { verify: (token: string) => unknown };
  };
  new jwtModule.LabJwtSigner(secretText, issuer, 7200, 604_800).verify(token);
  console.log("[global-setup] 3/5 真 JWT 铸造 + LabJwtSigner.verify 闭环通过");

  // 4. 真服务探针——
  //    a) 业务路由带 Bearer 200（服务可达 + guard 语义活着）；
  //    b) /api/auth/me 无 Bearer 恒 401（ADR-0019 负探针：真服务上活着的 guard）。
  const contractsRes = await fetch(`${BASE}/api/contracts`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!contractsRes.ok) {
    throw new Error(
      `fail-fast: GET /api/contracts 被拒（${contractsRes.status}）——核对 nextjs dev 状态`,
    );
  }
  const me = await fetch(`${BASE}/api/auth/me`, { signal: AbortSignal.timeout(30_000) });
  if (me.status !== 401) {
    throw new Error(
      `fail-fast: GET /api/auth/me 无 Bearer 期望 401（ADR-0019），实得 ${me.status}——guard 语义漂移`,
    );
  }
  console.log(
    "[global-setup] 4/5 真服务探针通过（/api/contracts 200 + /api/auth/me 401）",
  );

  // 5. 库身份探针：健康 ≠ 连的是目标库。自拉进程必然同源；复用进程必须实证。
  //    往 DATABASE_URL 插一行随机 contract_code 的探针合同（NOT NULL 七件 +
  //    tenant_id 对齐 JWT claim），服务 /api/contracts 读得到 = 同源；读完即删。
  const requireFromShared = createRequire(resolve(SHARED, "package.json"));
  const pgModule = requireFromShared("pg") as {
    Client: new (opts: { connectionString: string }) => {
      connect: () => Promise<void>;
      query: (sql: string, vals: unknown[]) => Promise<unknown>;
      end: () => Promise<void>;
    };
  };
  const markerCode = `__p2_probe_${randomUUID().slice(0, 8)}__`;
  const client = new pgModule.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO contracts (id, contract_code, client_unit, project_name,
         construction_unit, witness_unit, witness, tenant_id, status, created_at, updated_at)
       VALUES ($1, $2, '探针', '探针', '探针', '探针', '探针', $3, 'active', '', '')`,
      [randomUUID(), markerCode, tenantIds[0]],
    );
    try {
      const probeRes = await fetch(`${BASE}/api/contracts`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (!probeRes.ok) {
        throw new Error(`fail-fast: 库身份探针 HTTP ${probeRes.status}`);
      }
      const page = (await probeRes.json()) as {
        items?: Array<{ contract_code?: string; contractCode?: string }>;
      };
      const visible = (page.items ?? []).some(
        (c) => (c.contract_code ?? c.contractCode) === markerCode,
      );
      if (!visible) {
        throw new Error(
          `fail-fast: :5201 与 DATABASE_URL 目标库不同源——探针合同 ${markerCode} ` +
            `在目标库但服务读不到。自拉进程=${selfSpawned}。` +
            `请让 :5201 指向目标库或停掉它后重跑。`,
        );
      }
    } finally {
      await client.query(`DELETE FROM contracts WHERE contract_code = $1`, [markerCode]);
    }
  } finally {
    await client.end();
  }
  console.log(
    `[global-setup] 5/5 库身份探针通过（探针合同 ${markerCode} 经服务可见后已删）`,
  );

  // 双通道供测试消费：provide()（vitest inject）+ process.env（forks pool 子进程继承）
  provide("TEST_TOKEN", token);
  process.env["TEST_TOKEN"] = token;
}
