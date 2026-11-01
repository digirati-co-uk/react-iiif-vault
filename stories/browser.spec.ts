import { expect, test } from '@playwright/test';

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;
test('every user story renders without an application error', async ({ page, request }) => {
  const index = await (await request.get('/index.json')).json();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const entry of Object.values(index.entries) as { id: string; type: string; tags?: string[] }[]) {
    if (entry.type !== 'story' || entry.tags?.includes('live')) continue;
    await page.goto(story(entry.id));
    await expect(page.locator('.vault-story h1'), entry.id).toBeVisible();
    await expect(page.locator('#storybook-root')).not.toContainText('Maximum update depth exceeded');
    await page.waitForTimeout(150);
    expect(errors, entry.id).toEqual([]);
  }
});

test('drawing saves a triangle and history is reactive', async ({ page }) => {
  await page.goto(story('annotations-edit-a-region--draw-polygon'));
  const canvas = page.getByLabel('Drawing canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toBeVisible();
  const rect = (await canvas.boundingBox())!;
  for (const [x, y] of [
    [0.2, 0.2],
    [0.7, 0.2],
    [0.4, 0.7],
  ])
    await page.mouse.click(rect.x + rect.width * x, rect.y + rect.height * y);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Finish shape', exact: true }).click();
  await page.getByRole('button', { name: 'Save annotation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Editing finished');
  const geometry = JSON.parse((await page.getByTestId('geometry').textContent()) || '{}');
  expect(geometry.saved.open).toBe(false);
  expect(geometry.saved.points).toHaveLength(3);
});

test('curves remain cubic in the saved preview', async ({ page }) => {
  await page.goto(story('annotations-edit-a-region--curves'));
  await expect(page.getByTestId('bezier-controls')).toBeVisible();
  await page.getByRole('button', { name: 'Save annotation', exact: true }).click();
  await expect(page.locator('svg path[d*=" C "]')).toBeVisible();
});

test('Atlas viewer forwards drawing input and saves an annotation', async ({ page }) => {
  await page.goto(story('read-a-manifest-viewer--draw-in-viewer'));
  await page.getByRole('button', { name: 'Draw an annotation', exact: true }).click();
  const editor = page.locator('svg').filter({ has: page.locator('title', { hasText: 'Annotation Editor' }) });
  await expect(editor).toBeVisible();
  const rect = (await editor.boundingBox())!;
  for (const [x, y] of [
    [0.25, 0.3],
    [0.65, 0.3],
    [0.45, 0.65],
  ])
    await page.mouse.click(rect.x + rect.width * x, rect.y + rect.height * y);
  await page.mouse.move(rect.x + rect.width * 0.25, rect.y + rect.height * 0.3);
  await expect(page.getByTestId('vertex-hover')).toBeVisible();
  await expect(page.locator('canvas').first()).toHaveCSS('cursor', 'pointer');
  await expect(page.getByTestId('placement-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).hover();
  await expect(page.getByTestId('placement-preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finish shape', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Finish shape', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Draw an annotation', exact: true })).toBeEnabled();
  const saved = page.locator('.saved-drawing path');
  await expect(saved).toBeVisible();
  await page.mouse.move(rect.x + rect.width * 0.45, rect.y + rect.height * 0.4);
  await expect(saved).toHaveCSS('stroke', 'rgb(29, 78, 216)');
  await page.mouse.click(rect.x + rect.width * 0.45, rect.y + rect.height * 0.4);
  await expect(page.getByLabel('Drawing canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draw an annotation', exact: true })).toBeDisabled();
});

test('window blur discards a dragged preview', async ({ page }) => {
  await page.goto(story('annotations-edit-a-region--edit-vertices'));
  const canvas = page.getByLabel('Drawing canvas');
  await expect(canvas).toBeVisible();
  const rect = (await canvas.boundingBox())!;
  const before = JSON.parse((await page.getByTestId('geometry').textContent()) || '{}').current.points;
  await page.mouse.move(rect.x + rect.width / 6, rect.y + rect.height / 4);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 3, rect.y + rect.height / 3);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  const after = JSON.parse((await page.getByTestId('geometry').textContent()) || '{}').current.points;
  expect(after).toEqual(before);
});

test('a second native touch cancels editing until both contacts lift', async ({ page, context }) => {
  await page.goto(story('annotations-edit-a-region--edit-vertices'));
  const canvas = page.getByLabel('Drawing canvas');
  await expect(canvas).toBeVisible();
  const rect = (await canvas.boundingBox())!;
  const before = JSON.parse((await page.getByTestId('geometry').textContent()) || '{}').current.points;
  const cdp = await context.newCDPSession(page);
  const first = { id: 1, x: rect.x + rect.width / 6, y: rect.y + rect.height / 4 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, x: first.x + 40 }] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...first, x: first.x + 40 },
      { id: 2, x: first.x + 80, y: first.y + 40 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = JSON.parse((await page.getByTestId('geometry').textContent()) || '{}').current.points;
  expect(after).toEqual(before);
  await cdp.detach();
});

test('touch draws a rectangle through Atlas without a mobile-specific mode', async ({ page, context }) => {
  await page.goto(story('annotations-edit-a-region--rectangle'));
  const canvas = page.getByLabel('Drawing canvas');
  await expect(canvas).toBeVisible();
  const rect = (await canvas.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const first = { id: 1, x: rect.x + rect.width * 0.25, y: rect.y + rect.height * 0.25 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...first, x: first.x + 100, y: first.y + 80 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByRole('button', { name: 'Save annotation', exact: true }).click();
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('geometry').textContent()) || '{}').saved?.points.length)
    .toBe(4);
  await cdp.detach();
});

test('touch drags an existing Atlas vertex and undo restores it', async ({ page, context }) => {
  await page.goto(story('annotations-edit-a-region--edit-vertices'));
  const canvas = page.getByLabel('Drawing canvas');
  await expect(canvas).toBeVisible();
  const rect = (await canvas.boundingBox())!;
  const geometry = async () => JSON.parse((await page.getByTestId('geometry').textContent()) || '{}').current.points;
  const before = await geometry();
  const cdp = await context.newCDPSession(page);
  const first = { id: 1, x: rect.x + rect.width / 6 + 18, y: rect.y + rect.height / 4 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...first, x: first.x + 60, y: first.y + 30 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(geometry).not.toEqual(before);
  expect((await geometry()).slice(1)).toEqual(before.slice(1));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(geometry).toEqual(before);
  await cdp.detach();
});

for (const id of ['manuscript', 'map', 'object']) {
  test(`live IIIF ${id} loads tiles in Atlas`, async ({ page }) => {
    test.skip(!process.env.CHECK_LIVE_IIIF, 'Institutional networks are checked separately from offline regressions');
    const tiles: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.ok() && /\/(default|native)\.(jpg|png)(\?|$)/.test(response.url())) tiles.push(response.url());
    });
    await page.goto(story(`annotations-live-iiif-collections--${id}`));
    await expect(page.getByLabel('Drawing canvas')).toBeVisible();
    await expect.poll(() => tiles.length, { timeout: 30000 }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('an unscoped request uses one editor in a facing-page Atlas view', async ({ page }) => {
  await page.goto(story('read-a-manifest-viewer--draw-in-facing-pages'));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.getByRole('button', { name: 'Draw an annotation', exact: true }).click();
  await expect(page.getByLabel('Drawing canvas')).toHaveCount(1);
  await expect(page.getByLabel('Drawing canvas')).toBeVisible();
});
