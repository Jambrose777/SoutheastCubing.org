import { Events } from './types';

const WCA_EVENT_ORDER = new Map(Events.map((event, index) => [event, index]));

// Sorts event IDs to match the canonical WCA order used by the event picker.
export function orderEventIdsByWcaOrder(eventIds: string[]): string[] {
  return [...eventIds].sort((left, right) => {
    const orderDifference =
      (WCA_EVENT_ORDER.get(left) ?? Events.length) - (WCA_EVENT_ORDER.get(right) ?? Events.length);
    return orderDifference || left.localeCompare(right);
  });
}
