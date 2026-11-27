import { test, expect, type Page } from "@playwright/test";
async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Minhas viagens", exact: true }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Menu principal", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
test("motorista solicita um carro, vê detalhes e cancela o pedido", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await page
    .getByRole("button", { name: "Nova solicitação", exact: true })
    .first()
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Destino", { exact: true }).fill("Visita de teste");
  await modal
    .getByLabel("Saída prevista", { exact: true })
    .fill("2027-03-10T09:00");
  await modal
    .getByLabel("Retorno previsto", { exact: true })
    .fill("2027-03-10T12:00");
  await modal.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(modal).not.toBeVisible();
  const card = page.locator("article").filter({ hasText: "Visita de teste" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Ver solicitação" }).click();
  await expect(page.getByRole("dialog")).toContainText("Solicitação única");
  await page
    .getByRole("button", { name: "Cancelar solicitação", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
test("responsável aprova, motorista retira e devolve com declaração", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000002");
  await expect(
    page.getByRole("heading", { name: "Solicitações pendentes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aprovar", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Solicitação aprovada.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("heading", { name: "Minhas viagens", exact: true }),
  ).toBeVisible();
  const card = page.locator("article").filter({ hasText: "Livraria Shalom" });
  await card.getByRole("button", { name: "Ver detalhes" }).click();
  await page
    .getByRole("button", { name: "Registrar retirada", exact: true })
    .click();
  await page
    .getByLabel("Quilometragem de saída", { exact: true })
    .fill("12500");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Em andamento" }).click();
  await page
    .locator("article")
    .filter({ hasText: "Livraria Shalom" })
    .getByRole("button", { name: "Ver detalhes" })
    .click();
  await page
    .getByRole("button", { name: "Registrar devolução", exact: true })
    .click();
  await page
    .getByLabel("Quilometragem de retorno", { exact: true })
    .fill("12530");
  await page.getByLabel("Não houve problemas nem acidentes").check();
  await page.getByRole("button", { name: "Concluir devolução" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(
    page.locator("article").filter({ hasText: "Livraria Shalom" }),
  ).toContainText("Concluída");
});
test("calendário mantém privacidade, muda visão e não transborda no celular", async ({
  page,
}, testInfo) => {
  await enter(page);
  await navigate(page, "Calendário");
  await expect(
    page.getByRole("heading", { name: "Calendário", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "Destino privado de outro motorista",
  );
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await expect(page.locator(".calendar-day")).toHaveCount(42);
  await page.screenshot({
    path: `test-results/calendar-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Notificações,/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Seus avisos");
  await page.getByRole("button", { name: "Marcar todos como lidos" }).click();
  await expect(page.getByRole("dialog")).toContainText("Você está em dia.");
});
test("responsável cadastra, edita e exclui seus carros na tela de veículos", async ({
  page,
}) => {
  await enter(page);
  await navigate(page, "Veículos");
  await expect(
    page.getByRole("button", { name: "Cadastrar carro", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Editar carro", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000002");
  await navigate(page, "Veículos");
  await expect(
    page.getByRole("button", { name: "Editar carro", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Cadastrar carro", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Nome de identificação", { exact: true })
    .fill("Carro novo de teste");
  await modal.getByLabel("Modelo", { exact: true }).fill("Modelo teste");
  await modal.getByLabel("Placa", { exact: true }).fill("TST1A23");
  await modal
    .getByLabel("Unidade proprietária", { exact: true })
    .selectOption("10000000-0000-4000-8000-000000000001");
  await expect(
    modal.getByLabel("Responsável principal", { exact: true }),
  ).toHaveValue("Pedro Santos");
  await expect(
    modal.getByLabel("Responsável principal", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await modal.getByLabel("Foto do carro", { exact: true }).setInputFiles({
    name: "carro.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await modal.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(modal).not.toBeVisible();
  let card = page
    .locator(".vehicle-card")
    .filter({ hasText: "Carro novo de teste" });
  await expect(card).toContainText("Pedro Santos");
  await card.getByRole("button", { name: "Editar carro", exact: true }).click();
  await modal
    .getByLabel("Nome de identificação", { exact: true })
    .fill("Carro editado de teste");
  await modal.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(modal).not.toBeVisible();
  card = page
    .locator(".vehicle-card")
    .filter({ hasText: "Carro editado de teste" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Solicitações pendentes", exact: true }),
  ).toBeVisible();
  await navigate(page, "Veículos");
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card
    .getByRole("button", { name: "Excluir carro", exact: true })
    .click();
  await expect(modal).toContainText("histórico de viagens será preservado");
  await modal
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(card).toContainText("Inativo");
  await expect(
    card.getByRole("button", { name: "Solicitar carro", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000004");
  await navigate(page, "Veículos");
  await expect(card).toHaveCount(0);
});

test("administrador gerencia cadastros sem receber solicitações operacionais", async ({
  page,
}, testInfo) => {
  await enter(page);
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000003");
  await expect(
    page.getByRole("heading", { name: "Cadastros", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unidades", exact: true }).click();
  await page.getByRole("button", { name: "Novo cadastro" }).click();
  await page
    .getByLabel("Nome da unidade", { exact: true })
    .fill("Casa de teste");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".registry-list")).toContainText("Casa de teste");
  await page.screenshot({
    path: `test-results/admin-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page
      .getByRole("navigation", { name: "Menu principal", exact: true })
      .getByRole("button", { name: "Solicitações", exact: true })
      .count(),
  ).toBe(0);
});
test("devolução preserva comprovantes e fotos e responsável resolve a ocorrência", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000002");
  await page
    .getByRole("button", { name: "Aprovar", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Solicitação aprovada.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000001");
  await page
    .locator("article")
    .filter({ hasText: "Livraria Shalom" })
    .getByRole("button", { name: "Ver detalhes" })
    .click();
  await page
    .getByRole("button", { name: "Registrar retirada", exact: true })
    .click();
  await page
    .getByLabel("Quilometragem de saída", { exact: true })
    .fill("12500");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Em andamento" }).click();
  await page
    .locator("article")
    .filter({ hasText: "Livraria Shalom" })
    .getByRole("button", { name: "Ver detalhes" })
    .click();
  await page
    .getByRole("button", { name: "Registrar devolução", exact: true })
    .click();
  await page
    .getByLabel("Quilometragem de retorno", { exact: true })
    .fill("12520");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByLabel("Valor total (R$)").fill("85.90");
  await page
    .getByLabel("Foto do comprovante", { exact: true })
    .setInputFiles("public/icons/icon-192.png");
  await page.getByLabel("Preciso registrar uma ocorrência").check();
  await page
    .getByRole("button", { name: "Adicionar ocorrência", exact: true })
    .click();
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Lâmpada do farol não acende");
  await page.getByLabel("Local", { exact: true }).fill("Estacionamento");
  await page
    .getByLabel("Fotos obrigatórias", { exact: true })
    .setInputFiles("public/icons/icon-192.png");
  await page.getByRole("button", { name: "Concluir devolução" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("Perfil de demonstração")
    .selectOption("20000000-0000-4000-8000-000000000002");
  await navigate(page, "Ocorrências");
  await page.getByRole("button", { name: "Ver ocorrência" }).click();
  await expect(
    page.getByRole("img", { name: "Foto 1 da ocorrência" }),
  ).toBeVisible();
  await page.getByLabel("Situação", { exact: true }).selectOption("resolved");
  await page.getByLabel("Providências tomadas").fill("Lâmpada substituída");
  await page.getByRole("button", { name: "Salvar tratamento" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Resolvidas", exact: true }).click();
  await expect(page.locator("article")).toContainText(
    "Lâmpada do farol não acende",
  );
});
