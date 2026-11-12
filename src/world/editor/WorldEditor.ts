/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkZone } from '../core/WorkZone';
import type { Vec2 } from '../core/WorldTypes';
import type { TerrainStamp } from '../terrain/TerrainStamp';

export type EditorTool = 'terrain' | 'biome' | 'scatter' | 'spline' | 'workzone';
export type EditorSplineType = 'road' | 'river' | 'lake';

export interface WorldEditorPaletteItem {
  id: string;
  enabled: boolean;
  tags: string[];
}

export interface WorldEditorBiomeItem extends WorldEditorPaletteItem {
  priority: number;
}

export interface WorldEditorScatterItem extends WorldEditorPaletteItem {
  density: number;
}

export interface WorldEditorSplineItem {
  id: string;
  type: EditorSplineType;
  enabled: boolean;
  points: Vec2[];
}

export interface WorldEditorState {
  enabled: boolean;
  activeTool: EditorTool;
  worldName: string;
  seed: string;
  workZones: WorkZone[];
  terrainStamps: TerrainStamp[];
  biomeDefinitions: WorldEditorBiomeItem[];
  scatterGroups: WorldEditorScatterItem[];
  splineDefinitions: WorldEditorSplineItem[];
}

export interface WorldEditorCommand {
  id: string;
  description: string;
  apply(state: WorldEditorState): WorldEditorState;
  undo(state: WorldEditorState): WorldEditorState;
}

export function cloneWorldEditorState(state: WorldEditorState): WorldEditorState {
  return JSON.parse(JSON.stringify(state)) as WorldEditorState;
}

export function createDefaultWorldEditorState(overrides: Partial<WorldEditorState> = {}): WorldEditorState {
  const base: WorldEditorState = {
    enabled: false,
    activeTool: 'terrain',
    worldName: 'souldolls-world',
    seed: 'souldolls-world-seed',
    workZones: [],
    terrainStamps: [],
    biomeDefinitions: [],
    scatterGroups: [],
    splineDefinitions: [],
  };

  return {
    ...base,
    ...overrides,
    workZones: overrides.workZones ?? base.workZones,
    terrainStamps: overrides.terrainStamps ?? base.terrainStamps,
    biomeDefinitions: overrides.biomeDefinitions ?? base.biomeDefinitions,
    scatterGroups: overrides.scatterGroups ?? base.scatterGroups,
    splineDefinitions: overrides.splineDefinitions ?? base.splineDefinitions,
  };
}

export function createSetToolCommand(tool: EditorTool, previousTool?: EditorTool): WorldEditorCommand {
  const previous = previousTool ?? 'terrain';
  return {
    id: `tool:${tool}`,
    description: `Switch editor tool to ${tool}`,
    apply(state) {
      const next = cloneWorldEditorState(state);
      next.activeTool = tool;
      return next;
    },
    undo(state) {
      const next = cloneWorldEditorState(state);
      next.activeTool = previous;
      return next;
    },
  };
}

export function createToggleEditorCommand(
  state: WorldEditorState,
  enabled: boolean,
): WorldEditorCommand {
  const previousValue = state.enabled;
  return {
    id: `editor:${enabled ? 'enable' : 'disable'}`,
    description: enabled ? 'Enable editor' : 'Disable editor',
    apply(currentState) {
      const next = cloneWorldEditorState(currentState);
      next.enabled = enabled;
      return next;
    },
    undo(currentState) {
      const next = cloneWorldEditorState(currentState);
      next.enabled = previousValue;
      return next;
    },
  };
}

export class WorldEditor {
  private state: WorldEditorState;
  private readonly undoStack: WorldEditorCommand[] = [];
  private readonly redoStack: WorldEditorCommand[] = [];

  public constructor(initialState: WorldEditorState = createDefaultWorldEditorState()) {
    this.state = cloneWorldEditorState(initialState);
  }

  public getState(): WorldEditorState {
    return cloneWorldEditorState(this.state);
  }

  public setTool(tool: EditorTool): boolean {
    const previousTool = this.state.activeTool;
    return this.execute(createSetToolCommand(tool, previousTool));
  }

  public toggleEditor(enabled = !this.state.enabled): boolean {
    return this.execute(createToggleEditorCommand(this.state, enabled));
  }

  public execute(command: WorldEditorCommand): boolean {
    const nextState = command.apply(cloneWorldEditorState(this.state));
    if (JSON.stringify(nextState) === JSON.stringify(this.state)) {
      return false;
    }

    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.state = nextState;
    return true;
  }

  public undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }

    const previousState = command.undo(cloneWorldEditorState(this.state));
    this.redoStack.push(command);
    this.state = previousState;
    return true;
  }

  public redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }

    const nextState = command.apply(cloneWorldEditorState(this.state));
    this.undoStack.push(command);
    this.state = nextState;
    return true;
  }
}
