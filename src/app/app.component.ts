import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AuthStoreService } from "../state/auth-store.service";

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  constructor() {
    // App mount 时把 localStorage 恢复成 authenticated（react AuthProvider
    // effect hydrateAuth 同款时序）；无 token 落 anonymous。
    void inject(AuthStoreService).hydrate();
  }
}
