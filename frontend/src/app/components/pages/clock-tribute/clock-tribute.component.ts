import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import type {
  ClockCurrentRecords,
  ClockFourRoundCompetition,
  ClockMajorChampionship,
  ClockQualifyingPodium,
  ClockRecordMilestone,
  ClockResult,
  ClockSoutheastCompetition,
  ClockSoutheastChampion,
  ClockStatistics,
} from 'src/app/models/ClockResult';
import {
  ClockTributeSectionKind,
  ClockTributeSectionKindByEntryId,
  ContentfulEntryId,
} from 'src/app/models/Contentful';
import { ClockTributePageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
import { resolvedAsset, resolvedEntry, SubTopicEntryLink } from 'src/app/shared/contentful-links';
import { colorFromField } from 'src/app/shared/color-from-field';
import { contentfulImageUrl } from 'src/app/shared/contentful-image-url';
import { formatLongDate } from 'src/app/shared/date.util';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { MarkdownComponent, provideMarkdown } from 'ngx-markdown';
import { NgOptimizedImage } from '@angular/common';
import { HeaderComponent } from '../../core/header/header.component';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { ClockResultsTableComponent } from './clock-results-table/clock-results-table.component';
import { ClockMajorResultsTableComponent } from './clock-major-results-table/clock-major-results-table.component';
import { ClockScramblePracticePaneComponent } from './clock-scramble-practice-pane/clock-scramble-practice-pane.component';
import { ClockVideoPlaybackService } from './clock-video-playback.service';
import { formatClockValue } from './clock-results.util';
import {
  buildClockCompetitionCell,
  buildClockFourRoundCompetitionRows,
  buildClockPodiumCompetitorCells,
  buildClockRecordMilestoneRows,
  buildClockResultCells,
  buildClockSoutheastResultRow,
} from './clock-tribute-table-data';
import type {
  ClockResultsTableColumn,
  ClockResultsTableResult,
  ClockResultsTableRow,
} from './clock-results-table/clock-results-table.component';

type ClockTributeSection = SubTopic & { id: string; kind: ClockTributeSectionKind };
const RESULT_COLUMNS = {
  date: { key: 'date', label: 'Date' },
  cuber: { key: 'name', label: 'Cuber' },
  rank: { key: 'rank', label: 'World Rank' },
  podiumRank: { key: 'podiumRank', label: 'Rank' },
  record: { key: 'record', label: 'Record' },
  place: { key: 'place', label: 'Place' },
  sum: { key: 'sum', label: 'Sum' },
  first: { key: 'first', label: 'First' },
  firstResult: { key: 'firstResult', label: 'Result' },
  second: { key: 'second', label: 'Second' },
  secondResult: { key: 'secondResult', label: 'Result' },
  third: { key: 'third', label: 'Third' },
  thirdResult: { key: 'thirdResult', label: 'Result' },
  finalists: { key: 'finalists', label: 'Finalists' },
  champion: { key: 'champion', label: 'Champion' },
  winner: { key: 'winner', label: 'Winner' },
  single: { key: 'single', label: 'Single' },
  average: { key: 'average', label: 'Average' },
  state: { key: 'state', label: 'State' },
  competition: { key: 'competition', label: 'Competition' },
  video: { key: 'video', label: '', width: '3.5rem' },
  scramble: { key: 'scramble', label: '', width: '3.5rem' },
} satisfies Record<string, ClockResultsTableColumn>;
const PODIUM_RANK_COLORS: Record<number, 'gold' | 'silver' | 'bronze' | undefined> = {
  1: 'gold',
  2: 'silver',
  3: 'bronze',
};

@Component({
  selector: 'se-clock-tribute',
  templateUrl: './clock-tribute.component.html',
  styleUrls: ['./clock-tribute.component.scss'],
  providers: [provideMarkdown(), ClockVideoPlaybackService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    NgOptimizedImage,
    ClockResultsTableComponent,
    ClockMajorResultsTableComponent,
    ClockScramblePracticePaneComponent,
  ],
})
export class ClockTributeComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private http = inject(HttpClient);
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private subscriptions = new Subscription();

  readonly Colors = Colors;
  isMobile = this.screenSizeService.isMobile;
  title = signal('Clock in the Southeast');
  loadingContent = signal(true);
  sections = signal<ClockTributeSection[]>([]);
  activeSection = signal('');
  scramblePracticeResult = signal<ClockResultsTableResult | null>(null);
  loadingStatistics = signal(true);
  exportDate = signal<string | null>(null);
  currentRecords = signal<ClockCurrentRecords | null>(null);
  rankingHistory = signal<ClockResult[]>([]);
  femaleRecordAchievements = signal<ClockRecordMilestone[]>([]);
  regionalRecords = signal<ClockRecordMilestone[]>([]);
  qualifyingPodiums = signal<ClockQualifyingPodium[]>([]);
  majorChampionships = signal<ClockMajorChampionship[]>([]);
  southeastCompetitions = signal<ClockSoutheastCompetition[]>([]);
  fourRoundClockCompetitions = signal<ClockFourRoundCompetition[]>([]);
  southeastChampions = signal<ClockSoutheastChampion[]>([]);
  championshipLogoUrlsByAssetId = signal<Map<string, string>>(new Map());
  readonly formatClockValue = formatClockValue;
  currentRecordsColumns: ClockResultsTableColumn[] = [
    RESULT_COLUMNS.date,
    RESULT_COLUMNS.cuber,
    RESULT_COLUMNS.single,
    RESULT_COLUMNS.average,
    RESULT_COLUMNS.video,
    RESULT_COLUMNS.scramble,
    RESULT_COLUMNS.state,
    RESULT_COLUMNS.competition,
  ];
  currentRecordRows = computed<ClockResultsTableRow[]>(() => {
    const records = this.currentRecords();
    if (!records) return [];

    return (['single', 'average'] as const).map((rankingType) => {
      const record = records[rankingType];
      return {
        id: rankingType,
        ...buildClockResultCells(record),
      };
    });
  });
  rankingHistoryColumns: ClockResultsTableColumn[] = [
    RESULT_COLUMNS.date,
    RESULT_COLUMNS.cuber,
    RESULT_COLUMNS.rank,
    RESULT_COLUMNS.single,
    RESULT_COLUMNS.average,
    RESULT_COLUMNS.video,
    RESULT_COLUMNS.scramble,
    RESULT_COLUMNS.state,
    RESULT_COLUMNS.competition,
  ];
  rankingHistoryRows = computed<ClockResultsTableRow[]>(() => {
    return [...this.rankingHistory()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((record) => {
        const row = buildClockResultCells(record);
        return {
          id: `${record.date}-${record.rankingType}-${record.wcaId}-${record.competitionId}`,
          ...row,
          rank: { text: `#${record.rank}` },
        };
      });
  });
  recordMilestoneColumns: ClockResultsTableColumn[] = [
    RESULT_COLUMNS.date,
    RESULT_COLUMNS.record,
    RESULT_COLUMNS.cuber,
    RESULT_COLUMNS.single,
    RESULT_COLUMNS.average,
    RESULT_COLUMNS.video,
    RESULT_COLUMNS.scramble,
    RESULT_COLUMNS.state,
    RESULT_COLUMNS.competition,
  ];
  femaleRecordRows = computed<ClockResultsTableRow[]>(() =>
    buildClockRecordMilestoneRows(this.femaleRecordAchievements()),
  );
  regionalRecordRows = computed<ClockResultsTableRow[]>(() =>
    buildClockRecordMilestoneRows(this.regionalRecords()),
  );
  podiumColumns: ClockResultsTableColumn[] = [
    RESULT_COLUMNS.podiumRank,
    RESULT_COLUMNS.competition,
    RESULT_COLUMNS.sum,
    RESULT_COLUMNS.first,
    RESULT_COLUMNS.firstResult,
    RESULT_COLUMNS.second,
    RESULT_COLUMNS.secondResult,
    RESULT_COLUMNS.third,
    RESULT_COLUMNS.thirdResult,
    RESULT_COLUMNS.scramble,
  ];
  podiumRows = computed<ClockResultsTableRow[]>(() =>
    [...this.qualifyingPodiums()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((competition) => {
        const [firstCompetitor, secondCompetitor, thirdCompetitor] = competition.competitors;
        const first = buildClockPodiumCompetitorCells(competition, firstCompetitor);
        const second = buildClockPodiumCompetitorCells(competition, secondCompetitor);
        const third = buildClockPodiumCompetitorCells(competition, thirdCompetitor);

        return {
          id: competition.competitionId,
          podiumRank: {
            text: String(competition.rank),
            textColor: PODIUM_RANK_COLORS[competition.rank],
          },
          competition: buildClockCompetitionCell(competition),
          sum: { text: this.formatClockValue(competition.score) },
          first: first.name,
          firstResult: first.average,
          second: second.name,
          secondResult: second.average,
          third: third.name,
          thirdResult: third.average,
          result: {
            ...(first.result ? { firstResult: first.result } : {}),
            ...(second.result ? { secondResult: second.result } : {}),
            ...(third.result ? { thirdResult: third.result } : {}),
          },
        };
      }),
  );
  southeastChampionColumns: ClockResultsTableColumn[] = [
    RESULT_COLUMNS.competition,
    RESULT_COLUMNS.champion,
    RESULT_COLUMNS.single,
    RESULT_COLUMNS.average,
    RESULT_COLUMNS.video,
    RESULT_COLUMNS.scramble,
    RESULT_COLUMNS.state,
  ];
  southeastCompetitionColumns: ClockResultsTableColumn[] = [
    RESULT_COLUMNS.competition,
    RESULT_COLUMNS.winner,
    RESULT_COLUMNS.single,
    RESULT_COLUMNS.average,
    RESULT_COLUMNS.video,
    RESULT_COLUMNS.scramble,
    RESULT_COLUMNS.state,
  ];
  fourRoundCompetitionColumns: ClockResultsTableColumn[] = [
    { ...RESULT_COLUMNS.competition, width: '40%' },
    RESULT_COLUMNS.finalists,
  ];
  fourRoundCompetitionRows = computed<ClockResultsTableRow[]>(() =>
    buildClockFourRoundCompetitionRows(
      this.fourRoundClockCompetitions(),
      this.championshipLogoUrlsByAssetId(),
    ),
  );
  southeastCompetitionRows = computed<ClockResultsTableRow[]>(() =>
    [...this.southeastCompetitions()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((competition) =>
        buildClockSoutheastResultRow(competition, 'winner', this.championshipLogoUrlsByAssetId()),
      ),
  );
  southeastChampionRows = computed<ClockResultsTableRow[]>(() =>
    [...this.southeastChampions()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((champion) =>
        buildClockSoutheastResultRow(champion, 'champion', this.championshipLogoUrlsByAssetId()),
      ),
  );

  // Set the page theme and load editorial sections alongside generated statistics.
  ngOnInit(): void {
    this.themeService.setMainPaneColor(Colors.white);
    this.subscriptions.add(
      this.contentful
        .getContentfulEntry<ClockTributePageSkeleton>(ContentfulEntryId.clockTribute)
        .subscribe({
          next: (entry) => {
            this.title.set(entry.fields.title);
            this.sections.set(
              entry.fields.subTopics.map((subTopicLink, index) =>
                this.mapSubTopic(subTopicLink, index),
              ),
            );
            this.loadingContent.set(false);
          },
          error: (error) => {
            console.error('Failed to load the Clock Tribute page from Contentful:', error);
            this.loadingContent.set(false);
          },
        }),
    );
    this.subscriptions.add(
      this.http
        .get<ClockStatistics>('/assets/clock-tribute/clock-statistics-2026-10-18.json')
        .subscribe({
          next: (statistics) => {
            this.exportDate.set(formatLongDate(statistics.metadata.exportDate.slice(0, 10)));
            this.currentRecords.set(statistics.currentRecords);
            this.rankingHistory.set(statistics.rankings.results);
            this.femaleRecordAchievements.set(statistics.femaleRecordAchievements);
            this.regionalRecords.set(statistics.regionalRecords);
            this.qualifyingPodiums.set(statistics.podiums.qualifyingPodiums);
            this.majorChampionships.set(statistics.majorChampionships);
            this.southeastCompetitions.set(statistics.southeastCompetitions);
            this.fourRoundClockCompetitions.set(statistics.fourRoundClockCompetitions);
            this.southeastChampions.set(statistics.southeastChampions);
            const logoAssetIds = [
              ...new Set(
                [
                  ...statistics.majorChampionships.map((competition) => competition.logoAssetId),
                  ...statistics.southeastCompetitions.map((competition) => competition.logoAssetId),
                  ...statistics.fourRoundClockCompetitions.map(
                    (competition) => competition.logoAssetId,
                  ),
                  ...statistics.southeastChampions.map((champion) => champion.logoAssetId),
                ].filter((assetId): assetId is string => !!assetId),
              ),
            ];
            if (logoAssetIds.length > 0) {
              this.subscriptions.add(
                this.contentful.getContentfulAssets(logoAssetIds).subscribe({
                  next: (assets) => {
                    const logoUrlsByAssetId = new Map<string, string>();
                    for (const asset of assets.items) {
                      const url = asset.fields.file?.url;
                      if (url) {
                        logoUrlsByAssetId.set(asset.sys.id, contentfulImageUrl(url, 96));
                      }
                    }
                    this.championshipLogoUrlsByAssetId.set(logoUrlsByAssetId);
                  },
                  error: (error) => {
                    console.error(
                      'Failed to load Clock championship logos from Contentful:',
                      error,
                    );
                  },
                }),
              );
            }
            this.loadingStatistics.set(false);
          },
          error: (error) => {
            console.error('Failed to load Clock statistics:', error);
            this.loadingStatistics.set(false);
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Scroll TOC targets inside the page's own scroll container.
  scrollToSection(event: MouseEvent, mainPane: HTMLElement, sectionId: string): void {
    event.preventDefault();
    const target = mainPane.querySelector<HTMLElement>(`#${sectionId}`);
    if (!target) return;

    this.activeSection.set(sectionId);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Tracks the last section that crossed the main pane's reading line.
  onMainPaneScroll(mainPane: HTMLElement): void {
    const sections = this.sections();
    if (sections.length === 0) return;

    const readingLine = mainPane.getBoundingClientRect().top + 120;
    let activeId = sections[0].id;

    for (const section of sections) {
      const element = mainPane.querySelector<HTMLElement>(`#${section.id}`);
      if (!element || element.getBoundingClientRect().top > readingLine) break;
      activeId = section.id;
    }

    this.activeSection.set(activeId);
  }

  // Replace the section navigation with the selected result's scramble pane.
  openScramblePane(result: ClockResultsTableResult): void {
    this.scramblePracticeResult.set(result);
  }

  // Map a linked Contentful subTopic into the Clock page's section model.
  private mapSubTopic(link: SubTopicEntryLink, index: number): ClockTributeSection {
    const entry = resolvedEntry(link);
    const entryId = entry?.sys.id;
    const kind = entryId
      ? (ClockTributeSectionKindByEntryId[
          entryId as keyof typeof ClockTributeSectionKindByEntryId
        ] ?? 'generic')
      : 'generic';
    const photo = resolvedAsset(entry?.fields.photo);
    const photoSize = scaleToDisplaySize(
      photo?.fields.file?.details?.image?.width,
      photo?.fields.file?.details?.image?.height,
    );
    return {
      id: kind === 'generic' ? `clock-section-${index + 1}` : `clock-${kind}`,
      kind,
      title: entry?.fields.title ?? '',
      description: entry?.fields.description,
      photo: photo?.fields.file?.url,
      photoAlt: photo?.fields.description ?? '',
      photoWidth: photoSize.width,
      photoHeight: photoSize.height,
      videoEmbedUrl: entry?.fields.videoEmbedUrl,
      buttonText: entry?.fields.buttonText,
      buttonIcon: entry?.fields.buttonIcon,
      buttonInternalLink: entry?.fields.buttonInternalLink,
      buttonExternalLink: entry?.fields.buttonExternalLink,
      color: colorFromField(entry?.fields.color),
    };
  }
}
