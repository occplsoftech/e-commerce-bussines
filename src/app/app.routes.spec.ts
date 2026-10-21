import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { routes } from './app.routes';

@Component({ template: '' })
class Blank {}

describe('routes', () => {
  it('redirects the bare address to the dashboard instead of the empty sign-in layout', async () => {
    // Same order and shape as the real table, with the lazy components swapped for a blank one.
    const flat = routes.map((r) => ({ ...r, loadComponent: undefined, canActivate: undefined, children: undefined,
      component: r.redirectTo ? undefined : Blank }));
    TestBed.configureTestingModule({ providers: [provideRouter(flat)] });
    const router = TestBed.inject(Router);
    const tree = router.parseUrl('/');
    const state = router.config[0];

    expect(router.config[0].path).toBe('');
    expect(state.redirectTo).toBe('dashboard');
    expect(state.pathMatch).toBe('full');
    expect(tree.root.children['primary']).toBeUndefined();
  });
});
