/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkZone } from '../core/WorkZone';
import type { WorldEditorCommand, WorldEditorState } from './WorldEditor';
import { cloneWorldEditorState } from './WorldEditor';

export function createWorkZoneCommand(state: WorldEditorState, zone: WorkZone): WorldEditorCommand {
  const previous = cloneWorldEditorState(state).workZones;
  return {
    id: `workzone-save:${zone.id}`,
    description: `Save work zone ${zone.name || zone.id}`,
    apply(currentState) {
      const next = cloneWorldEditorState(currentState);
      const index = next.workZones.findIndex((candidate) => candidate.id === zone.id);
      if (index >= 0) {
        next.workZones[index] = zone;
      } else {
        next.workZones.push(zone);
      }
      return next;
    },
    undo(currentState) {
      const next = cloneWorldEditorState(currentState);
      next.workZones = previous;
      return next;
    },
  };
}

export function removeWorkZoneCommand(state: WorldEditorState, zoneId: string): WorldEditorCommand {
  const previous = cloneWorldEditorState(state).workZones;
  return {
    id: `workzone-remove:${zoneId}`,
    description: `Remove work zone ${zoneId}`,
    apply(currentState) {
      const next = cloneWorldEditorState(currentState);
      next.workZones = next.workZones.filter((zone) => zone.id !== zoneId);
      return next;
    },
    undo(currentState) {
      const next = cloneWorldEditorState(currentState);
      next.workZones = previous;
      return next;
    },
  };
}
