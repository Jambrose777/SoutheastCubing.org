import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { DelegatesComponent } from './components/delegates/delegates.component';
import { HomeComponent } from './components/home/home.component';
import { RouterModule, Routes } from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { InvolvementComponent } from './components/involvement/involvement.component';
import { ClubsComponent } from './components/clubs/clubs.component';
import { CompetitionsComponent } from './components/competitions/competitions.component';
import { HttpClientModule } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatMenuModule} from '@angular/material/menu';

const moduleRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'competitions', component: CompetitionsComponent },
  { path: 'clubs', component: ClubsComponent },
  { path: 'delegates', component: DelegatesComponent },
  { path: 'home', component: HomeComponent },
  { path: 'involvement', component: InvolvementComponent },
];

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    DelegatesComponent,
    HomeComponent,
    FooterComponent,
    InvolvementComponent,
    ClubsComponent,
    CompetitionsComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    RouterModule.forChild(moduleRoutes),
    NoopAnimationsModule,
    MatMenuModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
