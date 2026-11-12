/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { Bounds2 } from '../core/WorldTypes';
import { getTerrainHeight } from '../worldGen';

export interface StampGizmoConfig {
  x: number;
  z: number;
  scaleX: number;
  scaleZ: number;
  rotation: number;
  falloffInner: number;
}

export class EditorGizmoManager {
  private readonly scene: THREE.Scene;
  private readonly root: THREE.Group;

  // Cursor reticle
  private readonly cursorMesh: THREE.Mesh;
  private readonly cursorCenterDot: THREE.Mesh;

  // Stamp footprint
  private readonly stampGroup: THREE.Group;
  private readonly stampOuterLine: THREE.LineLoop;
  private readonly stampInnerLine: THREE.LineLoop;
  private readonly stampDirArrow: THREE.Line;

  // WorkZone bounding box
  private readonly workZoneGroup: THREE.Group;
  private readonly workZoneLine: THREE.LineLoop;

  private isVisible: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'world-editor-gizmos';

    // 1. Cursor Reticle (Gold pulsing ring)
    const ringGeo = new THREE.RingGeometry(0.7, 0.95, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf6d477,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cursorMesh = new THREE.Mesh(ringGeo, ringMat);
    this.cursorMesh.renderOrder = 999;
    this.root.add(this.cursorMesh);

    const dotGeo = new THREE.CircleGeometry(0.2, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cursorCenterDot = new THREE.Mesh(dotGeo, dotMat);
    this.cursorCenterDot.renderOrder = 1000;
    this.root.add(this.cursorCenterDot);

    // 2. Stamp Footprint
    this.stampGroup = new THREE.Group();
    this.stampGroup.visible = false;

    const circleSegments = 48;
    const outerPoints: THREE.Vector3[] = [];
    const innerPoints: THREE.Vector3[] = [];
    for (let i = 0; i < circleSegments; i++) {
      const angle = (i / circleSegments) * Math.PI * 2;
      outerPoints.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
      innerPoints.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
    }

    const outerGeo = new THREE.BufferGeometry().setFromPoints(outerPoints);
    const outerMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
    });
    this.stampOuterLine = new THREE.LineLoop(outerGeo, outerMat);
    this.stampGroup.add(this.stampOuterLine);

    const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);
    const innerMat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.5,
      linewidth: 1,
    });
    this.stampInnerLine = new THREE.LineLoop(innerGeo, innerMat);
    this.stampGroup.add(this.stampInnerLine);

    // Direction arrow forward
    const arrowGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-0.2, 0, 0.75),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0.2, 0, 0.75),
    ]);
    const arrowMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });
    this.stampDirArrow = new THREE.Line(arrowGeo, arrowMat);
    this.stampGroup.add(this.stampDirArrow);

    this.root.add(this.stampGroup);

    // 3. WorkZone Bounding Box
    this.workZoneGroup = new THREE.Group();
    this.workZoneGroup.visible = false;

    const wzPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(0, 0, 1),
    ];
    const wzGeo = new THREE.BufferGeometry().setFromPoints(wzPoints);
    const wzMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });
    this.workZoneLine = new THREE.LineLoop(wzGeo, wzMat);
    this.workZoneGroup.add(this.workZoneLine);

    this.root.add(this.workZoneGroup);

    this.setVisible(false);
    this.scene.add(this.root);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.root.visible = visible;
  }

  public updateCursor(x: number, y: number, z: number): void {
    if (!this.isVisible) return;
    const elevatedY = y + 0.12;
    this.cursorMesh.position.set(x, elevatedY, z);
    this.cursorCenterDot.position.set(x, elevatedY + 0.01, z);
  }

  public setStampGizmo(config: StampGizmoConfig | null): void {
    if (!config || !this.isVisible) {
      this.stampGroup.visible = false;
      return;
    }

    const y = getTerrainHeight(config.x, config.z) + 0.15;
    this.stampGroup.position.set(config.x, y, config.z);
    this.stampGroup.rotation.y = config.rotation;
    this.stampGroup.visible = true;

    // Scale outer circle
    this.stampOuterLine.scale.set(config.scaleX, 1, config.scaleZ);

    // Scale inner circle according to inner falloff
    const innerX = config.scaleX * Math.max(0.05, config.falloffInner);
    const innerZ = config.scaleZ * Math.max(0.05, config.falloffInner);
    this.stampInnerLine.scale.set(innerX, 1, innerZ);

    // Scale direction arrow
    this.stampDirArrow.scale.set(config.scaleX * 0.4, 1, config.scaleZ * 0.8);
  }

  public setWorkZoneGizmo(bounds: Bounds2 | null): void {
    if (!bounds || !this.isVisible) {
      this.workZoneGroup.visible = false;
      return;
    }

    const centerY = (getTerrainHeight(bounds.minX, bounds.minZ) +
      getTerrainHeight(bounds.maxX, bounds.minZ) +
      getTerrainHeight(bounds.maxX, bounds.maxZ) +
      getTerrainHeight(bounds.minX, bounds.maxZ)) * 0.25 + 0.18;

    const points = [
      new THREE.Vector3(bounds.minX, getTerrainHeight(bounds.minX, bounds.minZ) + 0.15, bounds.minZ),
      new THREE.Vector3(bounds.maxX, getTerrainHeight(bounds.maxX, bounds.minZ) + 0.15, bounds.minZ),
      new THREE.Vector3(bounds.maxX, getTerrainHeight(bounds.maxX, bounds.maxZ) + 0.15, bounds.maxZ),
      new THREE.Vector3(bounds.minX, getTerrainHeight(bounds.minX, bounds.maxZ) + 0.15, bounds.maxZ),
    ];

    this.workZoneLine.geometry.dispose();
    this.workZoneLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.workZoneGroup.visible = true;
  }

  public dispose(): void {
    this.scene.remove(this.root);
    this.cursorMesh.geometry.dispose();
    (this.cursorMesh.material as THREE.Material).dispose();
    this.cursorCenterDot.geometry.dispose();
    (this.cursorCenterDot.material as THREE.Material).dispose();
    this.stampOuterLine.geometry.dispose();
    (this.stampOuterLine.material as THREE.Material).dispose();
    this.stampInnerLine.geometry.dispose();
    (this.stampInnerLine.material as THREE.Material).dispose();
    this.stampDirArrow.geometry.dispose();
    (this.stampDirArrow.material as THREE.Material).dispose();
    this.workZoneLine.geometry.dispose();
    (this.workZoneLine.material as THREE.Material).dispose();
  }
}
