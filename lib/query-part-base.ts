
export abstract class QueryPart {

  public abstract placeholder: string;

  public abstract param(): any;
  public abstract format(): string;

  public toString(): string {
    return this.format();
  }

}

