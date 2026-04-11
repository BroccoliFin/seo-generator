import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class GenerateSeoDto {
  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  @MinLength(1)
  product_name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category!: string;

  @IsString()
  @IsNotEmpty({ message: 'Keywords are required' })
  @MinLength(3)
  keywords!: string;
}