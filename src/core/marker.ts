/**
 * A Marker represents a semantic tag attached to log entries (e.g., SECURITY, AUDIT, SQL).
 * Modeled after Log4j / SLF4J Marker, supporting hierarchical ancestor markers.
 */
export class Marker {
    public readonly name: string;
    private readonly parents: Marker[] = [];

    constructor(name: string, parents: Marker[] = []) {
        this.name = name;
        this.parents = [...parents];
    }

    /**
     * Adds a parent marker to this marker's hierarchy.
     */
    public addParent(parent: Marker): void {
        if (parent === this) {
            throw new Error('A marker cannot be its own parent.');
        }
        if (!this.parents.includes(parent)) {
            this.parents.push(parent);
        }
    }

    /**
     * Returns immediate parent markers.
     */
    public getParents(): Marker[] {
        return [...this.parents];
    }

    /**
     * Returns true if this marker or any of its recursive ancestor markers matches `other`.
     * @param other A Marker instance or string marker name.
     */
    public contains(other: Marker | string): boolean {
        const targetName = typeof other === 'string' ? other : other.name;
        if (this.name === targetName) {
            return true;
        }
        for (const parent of this.parents) {
            if (parent.contains(targetName)) {
                return true;
            }
        }
        return false;
    }

    public toString(): string {
        if (this.parents.length > 0) {
            const parentNames = this.parents.map(p => p.toString()).join(', ');
            return `${this.name} [ ${parentNames} ]`;
        }
        return this.name;
    }
}

/**
 * Factory and cache for canonical Marker instances.
 */
export class MarkerManager {
    private static readonly markers = new Map<string, Marker>();

    public static getMarker(name: string, ...parents: Marker[]): Marker {
        let marker = this.markers.get(name);
        if (!marker) {
            marker = new Marker(name, parents);
            this.markers.set(name, marker);
        } else {
            for (const parent of parents) {
                marker.addParent(parent);
            }
        }
        return marker;
    }

    public static clear(): void {
        this.markers.clear();
    }
}

/**
 * Standard enterprise markers.
 */
export const Markers = {
    SECURITY: MarkerManager.getMarker('SECURITY'),
    AUDIT: MarkerManager.getMarker('AUDIT'),
    PERF: MarkerManager.getMarker('PERF'),
    SQL: MarkerManager.getMarker('SQL'),
};
