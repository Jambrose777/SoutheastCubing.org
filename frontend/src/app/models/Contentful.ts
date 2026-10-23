export enum ContentfulEntryId {
  clubs = '5rv5MjBPpXmrwP2wSNXlxC',
  competitions = '51nAopVzhdMPbqxwm9sfQ4',
  delegates = '2OZsjVEk0sQMbDInOP24dT',
  home = 'VBd7CLFJeHCRE5VbPaIg3',
  involvement = '5L5pulcP34CUhYZ1OuhDDv',
  championships = '3WtF99CMBrSeRiznpCVbjp',
  contact = '2MMlKe63oGgs6881etRkSg',
  about = '15e2e1QADVMwVPci6a7PxE',
  pageNotFound = '6j2IxOmaYgOFEFEtlW62Tl',
  cats = '6ioa16NhQUuNlyZJHlpZ4e',
  linksConfiguration = '6GWjRKoJ7PP2XIAzqWrjis',
  clockTribute = '2bw7jfZW0rLExXF1j5En0I',
  contentfulInstructions = '4iB9XmEqE7lnKaqMYwJs81',
}

export enum ContentfulContentType {
  documents = 'documents',
  clubs = 'clubs',
  championships = 'championships',
  cats = 'cats',
  homePageOverride = 'homePageOverride',
}

export const ClockTributeSectionKindByEntryId = {
  nGV6d5uGyZt5sisu2IEjp: 'opening',
  '5umZmDEBynw2eQ59MhwNAT': 'current-records',
  '7vznFCOmC38NWKObG2KOMn': 'world-top-20',
  '4h655pmmBcQIXxw0DT3CsP': 'record-milestones',
  '2QdlbPcaFSLHDbdrgT2WqZ': 'competition-podiums',
  '47DCdy5NFdcair1lA1akN7': 'major-stage',
  '32tAjGmFGQRNy4pUvFsSUs': 'championship-history',
  '6ocBLmsJqiBzQJD2ztzhR8': 'extra-fun',
  '2cjHnYwHnL9ES5BJ1mnuXl': 'southeast-competitions',
} as const;

export type ClockTributeSectionKind =
  | (typeof ClockTributeSectionKindByEntryId)[keyof typeof ClockTributeSectionKindByEntryId]
  | 'generic';
